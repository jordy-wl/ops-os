import React, { useState } from 'react';
import { FileText, Sparkles, Database, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import GenerateDocumentModal from '@/components/documents/GenerateDocumentModal';
import DocumentViewer from '@/components/documents/DocumentViewer';
import OfferingRecommendations from './OfferingRecommendations';

export default function ClientDataAndAssets({ client, documents }) {
  const [showGenerateDocModal, setShowGenerateDocModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const queryClient = useQueryClient();

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId) => {
      await base44.entities.DocumentInstance.delete(documentId);
    },
    onSuccess: () => {
      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['documents', client.id] });
    },
    onError: () => {
      toast.error('Failed to delete document');
    }
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Group metadata fields by category (derived from field naming conventions)
  const groupedMetadata = React.useMemo(() => {
    if (!client.metadata) return {};
    
    const groups = {};
    Object.entries(client.metadata).forEach(([key, value]) => {
      // Skip internal fields
      if (key.startsWith('_')) return;
      
      // Derive category from field name (e.g., "financial_revenue" -> "financial")
      const parts = key.split('_');
      const category = parts.length > 1 ? parts[0] : 'General';
      
      if (!groups[category]) {
        groups[category] = [];
      }
      
      groups[category].push({ key, value });
    });
    
    return groups;
  }, [client.metadata]);

  return (
    <div className="space-y-4">
      {/* Documents */}
      <div className="neumorphic-raised rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[#A0AEC0]">Documents</h3>
          <Button
            size="sm"
            onClick={() => setShowGenerateDocModal(true)}
            className="bg-gradient-to-r from-[#BD00FF] to-[#9000cc] text-white text-xs"
          >
            <Sparkles className="w-3 h-3 mr-1" />
            Generate
          </Button>
        </div>
        
        {documents.length === 0 ? (
          <div className="neumorphic-pressed rounded-lg p-6 text-center">
            <FileText className="w-8 h-8 text-[#4A5568] mx-auto mb-2" />
            <p className="text-sm text-[#A0AEC0]">No documents yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.slice(0, 5).map((doc) => (
              <div
                key={doc.id}
                className="w-full neumorphic-pressed rounded-lg p-3 hover:bg-[#2C2E33] transition-colors flex items-center justify-between group"
              >
                <button
                  onClick={() => setSelectedDocument(doc)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left"
                >
                  <FileText className="w-4 h-4 text-[#BD00FF] flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-[#4A5568]">
                      {new Date(doc.generated_at).toLocaleDateString()}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-[#A0AEC0] capitalize">{doc.status}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Are you sure you want to delete this document?')) {
                        deleteDocumentMutation.mutate(doc.id);
                      }
                    }}
                    className="p-1 rounded hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete document"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Offering Recommendations */}
      <OfferingRecommendations 
        clientId={client.id}
        clientName={client.name}
        insights={client.insights}
      />

      {/* Collected Data Fields */}
      <div className="neumorphic-raised rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-[#00E5FF]" />
          <h3 className="text-sm font-medium text-[#A0AEC0]">Collected Data</h3>
        </div>
        
        {Object.keys(groupedMetadata).length === 0 ? (
          <div className="neumorphic-pressed rounded-lg p-6 text-center">
            <Database className="w-8 h-8 text-[#4A5568] mx-auto mb-2" />
            <p className="text-sm text-[#A0AEC0]">No data collected yet</p>
            <p className="text-xs text-[#4A5568] mt-1">Data will be populated from workflow tasks</p>
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(groupedMetadata).map(([category, fields]) => (
              <div key={category} className="neumorphic-pressed rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection(category)}
                  className="w-full p-3 flex items-center justify-between hover:bg-[#2C2E33] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {expandedSections[category] ? (
                      <ChevronDown className="w-4 h-4 text-[#A0AEC0]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#A0AEC0]" />
                    )}
                    <span className="text-sm font-medium capitalize">{category}</span>
                  </div>
                  <span className="text-xs text-[#4A5568]">{fields.length} fields</span>
                </button>
                
                {expandedSections[category] && (
                  <div className="px-3 pb-3 space-y-2">
                    {fields.map(({ key, value }) => (
                      <div key={key} className="flex justify-between items-start gap-2 text-xs">
                        <span className="text-[#A0AEC0] capitalize flex-shrink-0">
                          {key.split('_').slice(1).join(' ') || key}:
                        </span>
                        <span className="text-[#F5F5F5] text-right break-words">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <GenerateDocumentModal
        isOpen={showGenerateDocModal}
        onClose={() => setShowGenerateDocModal(false)}
        clientId={client.id}
      />

      <DocumentViewer
        document={selectedDocument}
        isOpen={!!selectedDocument}
        onClose={() => setSelectedDocument(null)}
      />
    </div>
  );
}