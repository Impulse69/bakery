import { useState, useMemo, useRef, useEffect } from 'react';
import type { Customer } from '@bakery/types';
import { Input, Button } from '@bakery/ui';
import styles from './CustomerCombobox.module.css';

interface CustomerComboboxProps {
  customers: Customer[];
  selectedCustomerId: string;
  onSelect: (customer: Customer | null) => void;
  onAddNew: (name: string) => void;
  label?: string;
  placeholder?: string;
}

export function CustomerCombobox({
  customers,
  selectedCustomerId,
  onSelect,
  onAddNew,
  label = 'Customer',
  placeholder = 'Search for a customer...',
}: CustomerComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // When a customer is selected externally, or we change selection,
  // we might want to sync the query text for display.
  // But usually, once selected, we show the name.
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  useEffect(() => {
    if (selectedCustomer) {
      setQuery(selectedCustomer.name);
    } else if (!selectedCustomerId) {
      setQuery('');
    }
  }, [selectedCustomer, selectedCustomerId]);

  const filtered = useMemo(() => {
    if (!query) return customers;
    const q = query.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q))
    );
  }, [customers, query]);

  const exactMatch = useMemo(
    () => customers.find((c) => c.name.toLowerCase() === query.toLowerCase()),
    [customers, query]
  );

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
    if (!e.target.value) {
      onSelect(null);
    }
  };

  const handleSelect = (customer: Customer) => {
    onSelect(customer);
    setQuery(customer.name);
    setIsOpen(false);
  };

  const handleAddNew = () => {
    if (!query.trim()) return;
    onAddNew(query.trim());
    setIsOpen(false);
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <Input
        label={label}
        value={query}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
      />

      {isOpen && (query || customers.length > 0) && (
        <div className={styles.dropdown}>
          {filtered.length > 0 ? (
            <div className={styles.list}>
              {filtered.map((c) => (
                <div
                  key={c.id}
                  className={`${styles.item}${c.id === selectedCustomerId ? ` ${styles.selected}` : ''}`}
                  onClick={() => handleSelect(c)}
                >
                  <div className={styles.itemName}>{c.name}</div>
                  {c.phone && <div className={styles.itemSub}>{c.phone}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.noResults}>No matches found.</div>
          )}

          {!exactMatch && query.trim() && (
            <div className={styles.addNew} onClick={handleAddNew}>
              <span className={styles.addIcon}>+</span> Create "<strong>{query}</strong>" as New Customer
            </div>
          )}
        </div>
      )}
    </div>
  );
}
