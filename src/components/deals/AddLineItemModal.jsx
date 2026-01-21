import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Wrench, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function AddLineItemModal({ isOpen, onClose, onAdd, clientId }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [offeringType, setOfferingType] = useState('product');
  const [selectedOffering, setSelectedOffering] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState('');
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.filter({ is_active: true })
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.filter({ is_active: true })
  });

  const offerings = offeringType === 'product' ? products : services;
  const filteredOfferings = offerings.filter(o => 
    o.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = () => {
    if (!selectedOffering) return;

    onAdd({
      offering_id: selectedOffering.id,
      offering_type: offeringType,
      quantity: Number(quantity),
      custom_price: customPrice ? Number(customPrice) : null
    });

    // Reset form
    setSelectedOffering(null);
    setQuantity(1);
    setCustomPrice('');
    setSearchTerm('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-[#2C2E33] border-[#3a3d44]">
        <DialogHeader>
          <DialogTitle>Add Line Item</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type Selector */}
          <div>
            <label className="text-sm text-[#A0AEC0] mb-2 block">Offering Type</label>
            <div className="neumorphic-pressed rounded-lg p-1 flex w-fit">
              <button
                onClick={() => {
                  setOfferingType('product');
                  setSelectedOffering(null);
                }}
                className={`px-4 py-2 rounded-md text-sm transition-all ${
                  offeringType === 'product' 
                    ? 'bg-[#2C2E33] text-[#00E5FF] shadow' 
                    : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
                }`}
              >
                <Package className="w-4 h-4 inline mr-2" />
                Products
              </button>
              <button
                onClick={() => {
                  setOfferingType('service');
                  setSelectedOffering(null);
                }}
                className={`px-4 py-2 rounded-md text-sm transition-all ${
                  offeringType === 'service' 
                    ? 'bg-[#2C2E33] text-[#00E5FF] shadow' 
                    : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
                }`}
              >
                <Wrench className="w-4 h-4 inline mr-2" />
                Services
              </button>
            </div>
          </div>

          {/* Search Offerings */}
          <div>
            <label className="text-sm text-[#A0AEC0] mb-2 block">Search {offeringType === 'product' ? 'Products' : 'Services'}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0AEC0]" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search ${offeringType}s...`}
                className="pl-10 bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>
          </div>

          {/* Offerings List */}
          <div className="max-h-48 overflow-y-auto space-y-2">
            {filteredOfferings.map(offering => (
              <div
                key={offering.id}
                onClick={() => setSelectedOffering(offering)}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  selectedOffering?.id === offering.id
                    ? 'bg-[#00E5FF]/10 border border-[#00E5FF]'
                    : 'bg-[#1A1B1E] hover:bg-[#2C2E33]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{offering.name}</p>
                    <p className="text-xs text-[#A0AEC0]">{offering.short_description}</p>
                    {offering.calculation_method && offering.calculation_method !== 'fixed_fee' && (
                      <p className="text-xs text-[#4A5568] mt-1">
                        {offering.calculation_method} • {offering.frequency}
                      </p>
                    )}
                  </div>
                  {offering.base_price && (
                    <p className="text-sm font-mono">${offering.base_price.toLocaleString()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {selectedOffering && (
            <>
              {/* Quantity and Custom Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-[#A0AEC0] mb-2 block">Quantity</label>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    className="bg-[#1A1B1E] border-[#2C2E33]"
                  />
                </div>
                <div>
                  <label className="text-sm text-[#A0AEC0] mb-2 block">Custom Price (Optional)</label>
                  <Input
                    type="number"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder={selectedOffering.base_price?.toString()}
                    className="bg-[#1A1B1E] border-[#2C2E33]"
                  />
                </div>
              </div>


            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!selectedOffering}
              className="bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
            >
              Add Line Item
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}