import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, top_k = 5, filter = {} } = await req.json();

    if (!query) {
      return Response.json({ error: 'query is required' }, { status: 400 });
    }

    // Generate embedding for the query using OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
        dimensions: 1536,
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error('OpenAI API error:', error);
      return Response.json({ error: 'Failed to generate query embedding' }, { status: 500 });
    }

    const { data } = await openaiResponse.json();
    const queryEmbedding = data[0].embedding;

    // Search Pinecone for similar vectors
    const pineconeHost = Deno.env.get('PINECONE_ENVIRONMENT');
    const pineconeApiKey = Deno.env.get('PINECONE_API_KEY');
    const pineconeIndex = Deno.env.get('PINECONE_INDEX_NAME');

    const pineconeQueryBody = {
      vector: queryEmbedding,
      topK: top_k,
      includeMetadata: true,
      namespace: pineconeIndex,
    };

    // Add metadata filters if provided
    if (filter && Object.keys(filter).length > 0) {
      pineconeQueryBody.filter = filter;
    }

    const pineconeResponse = await fetch(
      `https://${pineconeHost}/query`,
      {
        method: 'POST',
        headers: {
          'Api-Key': pineconeApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pineconeQueryBody),
      }
    );

    if (!pineconeResponse.ok) {
      const error = await pineconeResponse.text();
      console.error('Pinecone API error:', error);
      return Response.json({ error: 'Failed to search vector database' }, { status: 500 });
    }

    const { matches } = await pineconeResponse.json();

    if (!matches || matches.length === 0) {
      return Response.json({
        success: true,
        results: [],
        count: 0,
      });
    }

    // Extract knowledge asset IDs from matches
    const knowledgeAssetIds = matches
      .map(match => match.metadata?.knowledge_asset_id)
      .filter(Boolean);

    // Fetch the actual knowledge assets
    const knowledgeAssets = await base44.entities.KnowledgeAsset.filter({
      id: { $in: knowledgeAssetIds },
      is_active: true,
    });

    // Create a map for quick lookup
    const assetMap = {};
    knowledgeAssets.forEach(asset => {
      assetMap[asset.id] = asset;
    });

    // Combine results with similarity scores
    const results = matches
      .map(match => ({
        knowledge_asset: assetMap[match.metadata?.knowledge_asset_id],
        similarity_score: match.score,
        vector_id: match.id,
      }))
      .filter(result => result.knowledge_asset); // Only include found assets

    return Response.json({
      success: true,
      results,
      count: results.length,
      query,
    });
  } catch (error) {
    console.error('Error performing semantic search:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});