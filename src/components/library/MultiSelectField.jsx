import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from 'lucide-react';

export default function MultiSelectField({ options, value, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const selectedOptions = options.filter(opt => value?.includes(opt.path)) || [];
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggle = (path) => {
    const newValue = value?.includes(path) 
      ? value.filter(p => p !== path)
      : [...(value || []), path];
    onChange(newValue);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="w-full bg-[#1A1B1E] border border-[#2C2E33] rounded-md px-3 py-2 flex items-center justify-between text-xs h-8 hover:border-[#3a3d44] transition-colors"
        >
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {selectedOptions.length === 0 ? (
              <span className="text-[#4A5568]">{placeholder}</span>
            ) : (
              <div className="flex gap-1 flex-wrap">
                {selectedOptions.map(opt => (
                  <span key={opt.path} className="bg-[#2C2E33] px-2 py-1 rounded text-xs whitespace-nowrap">
                    {opt.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <ChevronDown className={`w-3 h-3 text-[#A0AEC0] flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 bg-[#2C2E33] border-[#3a3d44] p-0 z-50">
        <div className="p-2 border-b border-[#3a3d44]">
          <Input
            autoFocus
            placeholder="Search fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-[#1A1B1E] border-[#2C2E33] text-xs h-7"
          />
        </div>
        <div className="max-h-48 overflow-y-auto">
          {filteredOptions.map(opt => (
            <button
              key={opt.path}
              onClick={() => handleToggle(opt.path)}
              className="w-full px-3 py-2 text-left text-xs hover:bg-[#3a3d44] transition-colors flex items-center gap-2"
            >
              <div className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 ${
                value?.includes(opt.path) 
                  ? 'bg-[#00E5FF] border-[#00E5FF]' 
                  : 'border-[#2C2E33]'
              }`}>
                {value?.includes(opt.path) && <span className="text-[#121212] text-xs">✓</span>}
              </div>
              <span>{opt.label}</span>
            </button>
          ))}
          {filteredOptions.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-[#4A5568]">
              No fields found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}