"use client";

import React, { useState, useEffect, useRef } from "react";

export interface OptionItem {
  id: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: OptionItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
  icon?: string;
}

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "Select option...",
  required = false,
  disabled = false,
  style = {},
  icon = "🔍"
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.id === value);

  // Filter options based on query
  const filteredOptions = options.filter(
    (o) =>
      o.label.toLowerCase().includes(query.toLowerCase()) ||
      (o.sublabel && o.sublabel.toLowerCase().includes(query.toLowerCase())) ||
      o.id.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={dropdownRef} style={{ position: "relative", width: "100%", ...style }}>
      {/* Closed/Trigger State */}
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            if (!isOpen) setQuery("");
          }
        }}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: "14px",
          border: isOpen ? "2px solid #4F46E5" : "1px solid #CBD5E1",
          background: disabled ? "#F1F5F9" : "white",
          color: selectedOption ? "#0F172A" : "#94A3B8",
          fontWeight: 700,
          fontSize: "14px",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          transition: "all 0.15s ease",
          boxShadow: isOpen ? "0 4px 12px rgba(79, 70, 229, 0.15)" : "0 1px 2px rgba(0,0,0,0.02)",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {selectedOption && !disabled && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              style={{
                fontSize: "12px",
                color: "#94A3B8",
                padding: "2px 6px",
                borderRadius: "50%",
                background: "#F1F5F9",
                cursor: "pointer",
              }}
              title="Clear selection"
            >
              ✕
            </span>
          )}
          <span style={{ fontSize: "10px", color: "#64748B", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▼</span>
        </div>
      </div>

      {/* Hidden input for HTML5 native form required validation */}
      {required && (
        <input
          tabIndex={-1}
          autoComplete="off"
          style={{ opacity: 0, height: 0, width: 0, position: "absolute", bottom: 0, left: 0 }}
          value={value}
          onChange={() => {}}
          required={required}
        />
      )}

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "6px",
            background: "white",
            border: "1px solid #CBD5E1",
            borderRadius: "16px",
            boxShadow: "0 20px 30px -10px rgba(15, 23, 42, 0.2)",
            zIndex: 9999,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Search Input Header */}
          <div style={{ padding: "10px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <span style={{ position: "absolute", left: "12px", fontSize: "14px", color: "#64748B" }}>{icon}</span>
              <input
                autoFocus
                placeholder="Type to search and filter instantly..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 34px",
                  borderRadius: "10px",
                  border: "1px solid #CBD5E1",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#0F172A",
                  outline: "none",
                  background: "white",
                }}
              />
              {query && (
                <span
                  onClick={() => setQuery("")}
                  style={{ position: "absolute", right: "12px", fontSize: "12px", color: "#94A3B8", cursor: "pointer", fontWeight: 800 }}
                >
                  ✕
                </span>
              )}
            </div>
          </div>

          {/* Options List */}
          <div style={{ maxHeight: "240px", overflowY: "auto", padding: "6px" }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: "20px 14px", textAlign: "center", fontSize: "13px", color: "#64748B", fontWeight: 600 }}>
                ❌ No matches found for "{query}". Try typing a different keyword.
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.id === value;
                return (
                  <div
                    key={opt.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(opt.id);
                      setIsOpen(false);
                      setQuery("");
                    }}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "10px",
                      cursor: "pointer",
                      background: isSelected ? "#EEF2FF" : "transparent",
                      color: isSelected ? "#4F46E5" : "#0F172A",
                      fontWeight: isSelected ? 800 : 600,
                      fontSize: "13px",
                      transition: "all 0.15s",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                      marginBottom: "2px",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "#F1F5F9";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>{opt.label}</span>
                      {isSelected && <span style={{ fontSize: "12px", color: "#4F46E5" }}>✔ Selected</span>}
                    </div>
                    {opt.sublabel && (
                      <div style={{ fontSize: "11px", color: isSelected ? "#6366F1" : "#64748B", fontWeight: 500 }}>
                        {opt.sublabel}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
