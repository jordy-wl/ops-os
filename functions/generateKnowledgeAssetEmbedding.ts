import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { knowledge_asset_id } = await req.json();

    if (!knowledge_asset_id) {
      return Response.json({ error: 'knowledge_asset_id is required' }, { status: 400 });
    }

    // Fetch the knowledge asset
    const assets = await base44.asServiceRole.entities.KnowledgeAsset.filter({ id: knowledge_asset_id });
    const asset = assets[0];

    if (!asset) {
      return Response.json({ error: 'Knowledge asset not found' }, { status: 404 });
    }

    // Prepare text for embedding (combine title, description, and content)
    const textToEmbed = [
      asset.title,
      asset.description || '',
      asset.content || '',
      (asset.tags || []).join(' ')
    ].filter(Boolean).join('\n\n');

    if (!textToEmbed.trim()) {
      return Response.json({ error: 'No content to embed' }, { status: 400 });
    }

    // Generate embedding using OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: textToEmbed,
        dimensions: 1536,
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error('OpenAI API error:', error);
      return Response.json({ error: 'Failed to generate embedding' }, { status: 500 });
    }

    const { data } = await openaiResponse.json();
    const embedding = data[0].embedding;

    // Store embedding in Pinecone
    const pineconeHost = Deno.env.get('PINECONE_ENVIRONMENT');
    const pineconeApiKey = Deno.env.get('PINECONE_API_KEY');
    const pineconeIndex = Deno.env.get('PINECONE_INDEX_NAME');

    const vectorId = `ka_${knowledge_asset_id}`;

    const pineconeResponse = await fetch(
      `https://${pineconeHost}/vectors/upsert`,
      {
        method: 'POST',
        headers: {
          'Api-Key': pineconeApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vectors: [
            {
              id: vectorId,
              values: embedding,
              metadata: {
                knowledge_asset_id: knowledge_asset_id,
                title: asset.title,
                type: asset.type,
                tags: asset.tags || [],
                created_date: asset.created_date,
              },
            },
          ],
          namespace: pineconeIndex,
        }),
      }
    );

    if (!pineconeResponse.ok) {
      const error = await pineconeResponse.text();
      console.error('Pinecone API error:', error);
      return Response.json({ error: 'Failed to store embedding in vector database' }, { status: 500 });
    }

    // Update the knowledge asset with vector metadata
    await base44.asServiceRole.entities.KnowledgeAsset.update(knowledge_asset_id, {
      vector_id: vectorId,
      embedding_model: 'text-embedding-3-small',
      last_embedded_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      vector_id: vectorId,
      embedded_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating embedding:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});