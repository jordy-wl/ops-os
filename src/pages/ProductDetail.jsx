import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Package, Edit, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ProductDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => base44.entities.Product.list().then(products => products.find(p => p.id === productId)),
    enabled: !!productId,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#2C2E33] rounded w-1/4" />
          <div className="h-64 bg-[#2C2E33] rounded" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-6">
        <div className="neumorphic-pressed rounded-xl p-12 text-center">
          <Package className="w-12 h-12 text-[#4A5568] mx-auto mb-4" />
          <h3 className="font-medium mb-2">Product Not Found</h3>
          <Button onClick={() => navigate(createPageUrl('Offerings'))} className="mt-4">
            Back to Offerings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <button
        onClick={() => navigate(createPageUrl('Offerings'))}
        className="mb-6 text-[#A0AEC0] hover:text-[#F5F5F5] text-sm flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Offerings
      </button>

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Package className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold mb-2">{product.name}</h1>
              {product.sku && (
                <p className="text-sm text-[#A0AEC0] font-mono">SKU: {product.sku}</p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="bg-transparent border-[#2C2E33] hover:bg-[#2C2E33]">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" className="bg-transparent border-[#2C2E33] hover:bg-[#2C2E33]">
              <Archive className="w-4 h-4 mr-2" />
              {product.is_active ? 'Archive' : 'Activate'}
            </Button>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="neumorphic-pressed rounded-xl p-5 text-center">
              <p className="text-[#A0AEC0] text-xs mb-1">Price</p>
              <p className="font-mono font-semibold text-lg">
                {product.unit_price ? `$${product.unit_price.toLocaleString()} ${product.currency || 'USD'}` : '—'}
              </p>
            </div>
            <div className="neumorphic-pressed rounded-xl p-5 text-center">
              <p className="text-[#A0AEC0] text-xs mb-1">Category</p>
              <p className="capitalize font-medium">{product.category?.replace('_', ' ') || '—'}</p>
            </div>
            <div className="neumorphic-pressed rounded-xl p-5 text-center">
              <p className="text-[#A0AEC0] text-xs mb-1">Type</p>
              <p className="font-medium">{product.is_digital ? 'Digital' : 'Physical'}</p>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="neumorphic-raised rounded-xl p-6">
              <h3 className="text-sm font-medium text-[#A0AEC0] mb-3">Description</h3>
              <p className="text-[#F5F5F5]">{product.description}</p>
            </div>
          )}

          {/* Features */}
          {product.features && product.features.length > 0 && (
            <div className="neumorphic-raised rounded-xl p-6">
              <h3 className="text-sm font-medium text-[#A0AEC0] mb-3">Features</h3>
              <ul className="space-y-2">
                {product.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] mt-2" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Specifications */}
          {product.specifications && Object.keys(product.specifications).length > 0 && (
            <div className="neumorphic-raised rounded-xl p-6">
              <h3 className="text-sm font-medium text-[#A0AEC0] mb-3">Specifications</h3>
              <div className="space-y-2">
                {Object.entries(product.specifications).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-[#A0AEC0] capitalize">{key.replace('_', ' ')}:</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}