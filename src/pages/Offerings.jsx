import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Package,
  Wrench,
  Lightbulb,
  Search,
  Plus,
  Building2,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import CreateProductModal from '@/components/offerings/CreateProductModal';
import CreateServiceModal from '@/components/offerings/CreateServiceModal';
import CreateConceptModal from '@/components/offerings/CreateConceptModal';

const categoryColors = {
  software: 'from-blue-500 to-blue-600',
  hardware: 'from-gray-500 to-gray-600',
  add_on: 'from-purple-500 to-purple-600',
  consulting: 'from-orange-500 to-orange-600',
  implementation: 'from-cyan-500 to-cyan-600',
  support: 'from-green-500 to-green-600',
  training: 'from-yellow-500 to-yellow-600',
  methodology: 'from-pink-500 to-pink-600',
  framework: 'from-indigo-500 to-indigo-600',
};

function ProductCard({ product, onClick }) {
  return (
    <div
      onClick={onClick}
      className="neumorphic-raised rounded-xl p-5 cursor-pointer transition-all hover:translate-y-[-2px] group"
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${categoryColors[product.category] || 'from-[#2C2E33] to-[#1A1B1E]'} flex items-center justify-center`}>
          <Package className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium mb-1 truncate">{product.name}</h3>
          <p className="text-sm text-[#A0AEC0] line-clamp-2 mb-3">
            {product.description || 'No description'}
          </p>
          <div className="flex items-center gap-3 text-xs text-[#4A5568]">
            {product.sku && <span className="font-mono">{product.sku}</span>}
            {product.unit_price && (
              <>
                <span>•</span>
                <span className="font-mono">
                  ${product.unit_price.toLocaleString()} {product.currency || 'USD'}
                </span>
              </>
            )}
            {product.category && (
              <>
                <span>•</span>
                <span className="capitalize">{product.category.replace('_', ' ')}</span>
              </>
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-[#4A5568] group-hover:text-[#00E5FF] transition-colors" />
      </div>
    </div>
  );
}

function ServiceCard({ service, onClick }) {
  return (
    <div
      onClick={onClick}
      className="neumorphic-raised rounded-xl p-5 cursor-pointer transition-all hover:translate-y-[-2px] group"
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${categoryColors[service.category] || 'from-[#2C2E33] to-[#1A1B1E]'} flex items-center justify-center`}>
          <Wrench className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium mb-1 truncate">{service.name}</h3>
          <p className="text-sm text-[#A0AEC0] line-clamp-2 mb-3">
            {service.description || 'No description'}
          </p>
          <div className="flex items-center gap-3 text-xs text-[#4A5568]">
            {service.pricing_model && (
              <span className="capitalize">{service.pricing_model.replace('_', ' ')}</span>
            )}
            {service.base_price && (
              <>
                <span>•</span>
                <span className="font-mono">
                  ${service.base_price.toLocaleString()} {service.currency || 'USD'}
                </span>
              </>
            )}
            {service.category && (
              <>
                <span>•</span>
                <span className="capitalize">{service.category.replace('_', ' ')}</span>
              </>
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-[#4A5568] group-hover:text-[#00E5FF] transition-colors" />
      </div>
    </div>
  );
}

function ConceptCard({ concept, onClick }) {
  return (
    <div
      onClick={onClick}
      className="neumorphic-raised rounded-xl p-5 cursor-pointer transition-all hover:translate-y-[-2px] group"
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${categoryColors[concept.type] || 'from-[#2C2E33] to-[#1A1B1E]'} flex items-center justify-center`}>
          <Lightbulb className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium mb-1 truncate">{concept.name}</h3>
          <p className="text-sm text-[#A0AEC0] line-clamp-2 mb-3">
            {concept.description || 'No description'}
          </p>
          <div className="flex items-center gap-3 text-xs text-[#4A5568]">
            {concept.type && (
              <span className="capitalize">{concept.type.replace('_', ' ')}</span>
            )}
            {concept.version && (
              <>
                <span>•</span>
                <span>v{concept.version}</span>
              </>
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-[#4A5568] group-hover:text-[#00E5FF] transition-colors" />
      </div>
    </div>
  );
}

export default function Offerings() {
  const [activeTab, setActiveTab] = useState('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [showCreateService, setShowCreateService] = useState(false);
  const [showCreateConcept, setShowCreateConcept] = useState(false);
  const navigate = useNavigate();

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-created_date', 100),
  });

  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list('-created_date', 100),
  });

  const { data: concepts = [], isLoading: conceptsLoading } = useQuery({
    queryKey: ['business-concepts'],
    queryFn: () => base44.entities.BusinessConcept.list('-created_date', 100),
  });

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredServices = services.filter(s =>
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredConcepts = concepts.filter(c =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLoading = productsLoading || servicesLoading || conceptsLoading;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Offerings</h1>
          <p className="text-[#A0AEC0]">
            {products.length} products • {services.length} services • {concepts.length} concepts
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => setShowCreateProduct(true)}
            className="bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] hover:shadow-lg hover:shadow-[#00E5FF]/30"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
          <Button
            onClick={() => setShowCreateService(true)}
            className="bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-lg hover:shadow-orange-500/30"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Service
          </Button>
          <Button
            onClick={() => setShowCreateConcept(true)}
            className="bg-gradient-to-r from-[#BD00FF] to-[#8B00CC] text-white hover:shadow-lg hover:shadow-[#BD00FF]/30"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Concept
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-6">
        <div className="neumorphic-pressed rounded-lg p-1 flex">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-md text-sm transition-all flex items-center gap-2 ${
              activeTab === 'products'
                ? 'bg-[#2C2E33] text-[#00E5FF] shadow'
                : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
            }`}
          >
            <Package className="w-4 h-4" />
            Products
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className={`px-4 py-2 rounded-md text-sm transition-all flex items-center gap-2 ${
              activeTab === 'services'
                ? 'bg-[#2C2E33] text-[#00E5FF] shadow'
                : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
            }`}
          >
            <Wrench className="w-4 h-4" />
            Services
          </button>
          <button
            onClick={() => setActiveTab('concepts')}
            className={`px-4 py-2 rounded-md text-sm transition-all flex items-center gap-2 ${
              activeTab === 'concepts'
                ? 'bg-[#2C2E33] text-[#00E5FF] shadow'
                : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
            }`}
          >
            <Lightbulb className="w-4 h-4" />
            Concepts
          </button>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md neumorphic-pressed rounded-lg px-4 py-2 flex items-center gap-3">
          <Search className="w-4 h-4 text-[#A0AEC0]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search offerings..."
            className="bg-transparent flex-1 focus:outline-none placeholder-[#4A5568]"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-[#2C2E33] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : activeTab === 'products' ? (
        filteredProducts.length === 0 ? (
          <div className="neumorphic-pressed rounded-xl p-12 text-center">
            <Package className="w-12 h-12 text-[#4A5568] mx-auto mb-4" />
            <h3 className="font-medium mb-2">No Products Found</h3>
            <p className="text-[#A0AEC0] mb-4">
              {searchQuery ? 'Try a different search term.' : 'Add your first product to get started.'}
            </p>
            {!searchQuery && (
              <Button
                onClick={() => setShowCreateProduct(true)}
                className="bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
              >
                Add Product
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => navigate(createPageUrl('ProductDetail') + `?id=${product.id}`)}
              />
            ))}
          </div>
        )
      ) : activeTab === 'services' ? (
        filteredServices.length === 0 ? (
          <div className="neumorphic-pressed rounded-xl p-12 text-center">
            <Wrench className="w-12 h-12 text-[#4A5568] mx-auto mb-4" />
            <h3 className="font-medium mb-2">No Services Found</h3>
            <p className="text-[#A0AEC0] mb-4">
              {searchQuery ? 'Try a different search term.' : 'Add your first service to get started.'}
            </p>
            {!searchQuery && (
              <Button
                onClick={() => setShowCreateService(true)}
                className="bg-gradient-to-r from-orange-500 to-orange-600 text-white"
              >
                Add Service
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredServices.map(service => (
              <ServiceCard
                key={service.id}
                service={service}
                onClick={() => navigate(createPageUrl('ServiceDetail') + `?id=${service.id}`)}
              />
            ))}
          </div>
        )
      ) : (
        filteredConcepts.length === 0 ? (
          <div className="neumorphic-pressed rounded-xl p-12 text-center">
            <Lightbulb className="w-12 h-12 text-[#4A5568] mx-auto mb-4" />
            <h3 className="font-medium mb-2">No Concepts Found</h3>
            <p className="text-[#A0AEC0] mb-4">
              {searchQuery ? 'Try a different search term.' : 'Add your first concept to get started.'}
            </p>
            {!searchQuery && (
              <Button
                onClick={() => setShowCreateConcept(true)}
                className="bg-gradient-to-r from-[#BD00FF] to-[#8B00CC] text-white"
              >
                Add Concept
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredConcepts.map(concept => (
              <ConceptCard
                key={concept.id}
                concept={concept}
                onClick={() => navigate(createPageUrl('BusinessConceptDetail') + `?id=${concept.id}`)}
              />
            ))}
          </div>
        )
      )}

      {/* Modals */}
      <CreateProductModal isOpen={showCreateProduct} onClose={() => setShowCreateProduct(false)} />
      <CreateServiceModal isOpen={showCreateService} onClose={() => setShowCreateService(false)} />
      <CreateConceptModal isOpen={showCreateConcept} onClose={() => setShowCreateConcept(false)} />
    </div>
  );
}