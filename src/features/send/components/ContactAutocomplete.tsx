import React from 'react';
import type { Contact } from '@breeztech/breez-sdk-spark';

interface ContactAutocompleteProps {
  contacts: Contact[];
  isVisible: boolean;
  isLoading: boolean;
  onSelect: (paymentIdentifier: string) => void;
}

const ContactAutocomplete: React.FC<ContactAutocompleteProps> = ({ contacts, isVisible, isLoading, onSelect }) => {
  if (!isVisible || !contacts.length || isLoading) return null;

  return (
  <div
    className="absolute left-0 right-0 top-full z-10 bg-vendly-light border border-vendly-border border-t-0 rounded-b-xl shadow-lg overflow-hidden max-h-[192px] overflow-y-auto"
    onMouseDown={(e) => e.preventDefault()}
  >
    {contacts.map((contact, index) => (
      <button
        key={contact.id}
        onClick={() => onSelect(contact.paymentIdentifier)}
        className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-vendly-tint transition-colors text-left ${
          index > 0 ? 'border-t border-vendly-border' : ''
        }`}
      >
        <div className="w-8 h-8 rounded-full bg-vendly-tint flex items-center justify-center flex-shrink-0">
          <span className="text-vendly-ink font-display font-bold text-xs">
            {contact.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-vendly-ink truncate">
            {contact.name}
          </p>
          <p className="text-xs text-vendly-muted truncate">
            {contact.paymentIdentifier}
          </p>
        </div>
      </button>
    ))}
  </div>
);
};

export default ContactAutocomplete;
