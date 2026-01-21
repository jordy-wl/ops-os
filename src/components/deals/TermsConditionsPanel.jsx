import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Plus, X, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function TermsConditionsPanel({ dealId, selectedTermBlockIds = [], onUpdate }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [customTerms, setCustomTerms] = useState('');

  const { data: termBlocks = [] } = useQuery({
    queryKey: ['term-blocks'],
    queryFn: () => base44.entities.TermBlock.list('-created_date', 100)
  });

  const filteredTermBlocks = termBlocks.filter(block =>
    block.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    block.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedTerms = termBlocks.filter(block => 
    selectedTermBlockIds.includes(block.id)
  );

  const toggleTermBlock = (blockId) => {
    const newSelection = selectedTermBlockIds.includes(blockId)
      ? selectedTermBlockIds.filter(id => id !== blockId)
      : [...selectedTermBlockIds, blockId];
    
    onUpdate({ terms_and_conditions: newSelection });
  };

  const categoryColors = {
    payment_terms: 'bg-blue-500/20 text-blue-400',
    liability: 'bg-red-500/20 text-red-400',
    confidentiality: 'bg-purple-500/20 text-purple-400',
    termination: 'bg-orange-500/20 text-orange-400',
    intellectual_property: 'bg-green-500/20 text-green-400',
    warranties: 'bg-cyan-500/20 text-cyan-400',
    indemnification: 'bg-pink-500/20 text-pink-400',
    dispute_resolution: 'bg-yellow-500/20 text-yellow-400',
    general: 'bg-gray-500/20 text-gray-400',
    custom: 'bg-[#2C2E33] text-[#A0AEC0]'
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-4">Terms & Conditions</h3>
        
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0AEC0]" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search term blocks..."
            className="pl-10 bg-[#1A1B1E] border-[#2C2E33]"
          />
        </div>

        {/* Selected Terms */}
        {selectedTerms.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-[#A0AEC0] mb-2">Selected Terms ({selectedTerms.length})</p>
            <div className="space-y-2">
              {selectedTerms.map(term => (
                <div key={term.id} className="neumorphic-pressed rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{term.name}</p>
                        <Badge className={categoryColors[term.category]}>
                          {term.category?.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#A0AEC0] line-clamp-2">{term.content}</p>
                    </div>
                    <button
                      onClick={() => toggleTermBlock(term.id)}
                      className="p-1 rounded hover:bg-red-500/20 text-red-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Terms */}
        <div>
          <p className="text-sm text-[#A0AEC0] mb-2">Available Terms</p>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {filteredTermBlocks
              .filter(block => !selectedTermBlockIds.includes(block.id))
              .map(block => (
                <div
                  key={block.id}
                  onClick={() => toggleTermBlock(block.id)}
                  className="neumorphic-raised rounded-lg p-3 cursor-pointer hover:bg-[#2C2E33] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{block.name}</p>
                        <Badge className={categoryColors[block.category]}>
                          {block.category?.replace('_', ' ')}
                        </Badge>
                        {block.is_required && (
                          <Badge className="bg-red-500/20 text-red-400 text-xs">Required</Badge>
                        )}
                      </div>
                      <p className="text-xs text-[#A0AEC0] line-clamp-2">{block.content}</p>
                    </div>
                    <Plus className="w-4 h-4 text-[#00E5FF] flex-shrink-0" />
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Custom Terms */}
        <div className="mt-4">
          <label className="text-sm text-[#A0AEC0] mb-2 block">Custom Terms (Optional)</label>
          <Textarea
            value={customTerms}
            onChange={(e) => {
              setCustomTerms(e.target.value);
              onUpdate({ custom_terms: e.target.value });
            }}
            placeholder="Add any custom terms specific to this deal..."
            className="bg-[#1A1B1E] border-[#2C2E33] h-32"
          />
        </div>
      </div>
    </div>
  );
}