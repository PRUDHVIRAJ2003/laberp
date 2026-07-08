"use client";

import React, { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

type ComponentItem = {
  id: string;
  type: "title" | "component";
  name: string;
  unit?: string;
  resultType?: "text" | "select";
  options?: string[];
  referenceRange?: string;
  separated?: boolean;
  status?: boolean;
};

export default function CreateTestDynamic() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [sampleType, setSampleType] = useState("");
  const [price, setPrice] = useState("");
  const [precautions, setPrecautions] = useState("");
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [saving, setSaving] = useState(false);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addTitle = () => {
    setComponents([...components, { id: generateId(), type: "title", name: "" }]);
  };

  const addComponent = () => {
    setComponents([...components, {
      id: generateId(),
      type: "component",
      name: "",
      unit: "",
      resultType: "text",
      options: [],
      referenceRange: "",
      separated: false,
      status: false
    }]);
  };

  const removeComponent = (id: string) => {
    setComponents(components.filter(c => c.id !== id));
  };

  const updateComponent = (id: string, field: keyof ComponentItem, value: any) => {
    setComponents(components.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const addOption = (compId: string) => {
    setComponents(components.map(c => {
      if (c.id === compId && c.resultType === 'select') {
        return { ...c, options: [...(c.options || []), ""] };
      }
      return c;
    }));
  };

  const updateOption = (compId: string, index: number, value: string) => {
    setComponents(components.map(c => {
      if (c.id === compId && c.options) {
        const newOpts = [...c.options];
        newOpts[index] = value;
        return { ...c, options: newOpts };
      }
      return c;
    }));
  };

  const removeOption = (compId: string, index: number) => {
    setComponents(components.map(c => {
      if (c.id === compId && c.options) {
        const newOpts = [...c.options];
        newOpts.splice(index, 1);
        return { ...c, options: newOpts };
      }
      return c;
    }));
  };

  const handleSave = async () => {
    if (!name) return alert("Name is required");
    setSaving(true);
    const { error } = await supabase.from('tests').insert([{
      name,
      shortcut,
      sample_type: sampleType,
      price: price ? parseFloat(price) : null,
      precautions,
      components
    }]);
    
    if (error) {
      alert("Error saving: " + error.message);
      setSaving(false);
    } else {
      router.push("/admin/tests");
    }
  };

  return (
    <div className="flex-col gap-6" style={{ paddingBottom: '100px' }}>
      
      {/* Top Header */}
      <div style={{ backgroundColor: 'var(--google-blue)', color: 'white', padding: '16px 24px', borderRadius: '8px 8px 0 0', fontWeight: 600 }}>
        Create
      </div>

      <div className="card p-6" style={{ borderRadius: '0 0 8px 8px', marginTop: '-24px', borderTop: 'none' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#333' }}>Name</label>
            <input type="text" className="input-field" style={{ padding: '8px 12px', height: '40px', border: '1px solid #ddd', borderRadius: '4px' }} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#333' }}>Shortcut</label>
            <input type="text" className="input-field" style={{ padding: '8px 12px', height: '40px', border: '1px solid #ddd', borderRadius: '4px' }} value={shortcut} onChange={e => setShortcut(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#333' }}>Sample Type</label>
            <input type="text" className="input-field" style={{ padding: '8px 12px', height: '40px', border: '1px solid #ddd', borderRadius: '4px' }} value={sampleType} onChange={e => setSampleType(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#333' }}>Price</label>
            <div style={{ display: 'flex' }}>
              <input type="number" className="input-field" style={{ padding: '8px 12px', height: '40px', border: '1px solid #ddd', borderRadius: '4px 0 0 4px', borderRight: 'none' }} value={price} onChange={e => setPrice(e.target.value)} />
              <div style={{ backgroundColor: '#f1f3f4', border: '1px solid #ddd', padding: '0 12px', display: 'flex', alignItems: 'center', borderRadius: '0 4px 4px 0', fontSize: '14px', color: '#666' }}>USD</div>
            </div>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#333' }}>Precautions</label>
          <textarea className="input-field" style={{ width: '100%', height: '80px', padding: '12px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }} placeholder="Precautions" value={precautions} onChange={e => setPrecautions(e.target.value)} />
        </div>
      </div>

      {/* Dynamic Test Components Section */}
      <div className="card mt-4" style={{ borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--google-blue)' }}>
          <h3 style={{ fontSize: '16px', color: '#666' }}>Test Components</h3>
          <div className="flex gap-2">
            <button onClick={addTitle} className="btn btn-primary" style={{ height: '32px', padding: '0 16px', borderRadius: '4px', fontSize: '14px' }}>+ Title</button>
            <button onClick={addComponent} className="btn btn-primary" style={{ height: '32px', padding: '0 16px', borderRadius: '4px', fontSize: '14px' }}>+ Component</button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--google-blue)', color: 'white' }}>
                <th style={{ padding: '12px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Name</th>
                <th style={{ padding: '12px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Unit</th>
                <th style={{ padding: '12px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Result</th>
                <th style={{ padding: '12px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Reference Range</th>
                <th style={{ padding: '12px', borderRight: '1px solid rgba(255,255,255,0.2)', textAlign: 'center' }}>Separated</th>
                <th style={{ padding: '12px', borderRight: '1px solid rgba(255,255,255,0.2)', textAlign: 'center' }}>status</th>
                <th style={{ padding: '12px', width: '60px' }}></th>
              </tr>
            </thead>
            <tbody>
              {components.map((comp, index) => (
                <React.Fragment key={comp.id}>
                  {comp.type === 'title' ? (
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <td colSpan={6} style={{ padding: '12px' }}>
                        <input type="text" placeholder="Title" value={comp.name} onChange={e => updateComponent(comp.id, 'name', e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px' }} />
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                         <button onClick={() => removeComponent(comp.id)} style={{ width: '32px', height: '32px', borderRadius: '16px', backgroundColor: 'var(--google-red)', color: 'white', border: 'none', cursor: 'pointer' }}>🗑</button>
                      </td>
                    </tr>
                  ) : (
                    <tr style={{ borderBottom: '1px solid #eee', backgroundColor: '#fafafa' }}>
                      <td style={{ padding: '12px', verticalAlign: 'top', borderRight: '1px solid #eee' }}>
                         <input type="text" placeholder="Component" value={comp.name} onChange={e => updateComponent(comp.id, 'name', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                      </td>
                      <td style={{ padding: '12px', verticalAlign: 'top', borderRight: '1px solid #eee' }}>
                         <input type="text" placeholder="Unit" value={comp.unit} onChange={e => updateComponent(comp.id, 'unit', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                      </td>
                      <td style={{ padding: '12px', verticalAlign: 'top', borderRight: '1px solid #eee', minWidth: '150px' }}>
                         <div className="flex gap-4 mb-2">
                           <label className="flex items-center gap-1 cursor-pointer">
                             <input type="radio" checked={comp.resultType === 'text'} onChange={() => updateComponent(comp.id, 'resultType', 'text')} /> Text
                           </label>
                           <label className="flex items-center gap-1 cursor-pointer">
                             <input type="radio" checked={comp.resultType === 'select'} onChange={() => updateComponent(comp.id, 'resultType', 'select')} /> Select
                           </label>
                         </div>
                         
                         {comp.resultType === 'select' && (
                           <div style={{ backgroundColor: '#eee', padding: '12px', borderRadius: '4px', marginTop: '8px' }}>
                             <div className="flex justify-between items-center mb-2">
                               <span style={{ fontSize: '13px', fontWeight: 600 }}>Option</span>
                               <button onClick={() => addOption(comp.id)} style={{ width: '24px', height: '24px', borderRadius: '12px', backgroundColor: 'var(--google-blue)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>+</button>
                             </div>
                             {comp.options?.map((opt, oIdx) => (
                               <div key={oIdx} className="flex gap-2 items-center mb-2">
                                 <input type="text" value={opt} onChange={e => updateOption(comp.id, oIdx, e.target.value)} style={{ flexGrow: 1, padding: '4px 8px', border: '1px solid #ccc', borderRadius: '2px' }} />
                                 <button onClick={() => removeOption(comp.id, oIdx)} style={{ width: '24px', height: '24px', borderRadius: '12px', backgroundColor: 'var(--google-red)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>🗑</button>
                               </div>
                             ))}
                           </div>
                         )}
                      </td>
                      <td style={{ padding: '12px', verticalAlign: 'top', borderRight: '1px solid #eee' }}>
                         <input type="text" value={comp.referenceRange} onChange={e => updateComponent(comp.id, 'referenceRange', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                      </td>
                      <td style={{ padding: '12px', verticalAlign: 'top', borderRight: '1px solid #eee', textAlign: 'center' }}>
                         <input type="checkbox" checked={comp.separated} onChange={e => updateComponent(comp.id, 'separated', e.target.checked)} style={{ width: '18px', height: '18px' }} />
                      </td>
                      <td style={{ padding: '12px', verticalAlign: 'top', borderRight: '1px solid #eee', textAlign: 'center' }}>
                         <input type="checkbox" checked={comp.status} onChange={e => updateComponent(comp.id, 'status', e.target.checked)} style={{ width: '18px', height: '18px' }} />
                      </td>
                      <td style={{ padding: '12px', verticalAlign: 'top', textAlign: 'center' }}>
                         <button onClick={() => removeComponent(comp.id)} style={{ width: '32px', height: '32px', borderRadius: '16px', backgroundColor: 'var(--google-red)', color: 'white', border: 'none', cursor: 'pointer' }}>🗑</button>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {components.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#999' }}>
                    Click "+ Title" or "+ Component" to build your test.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="flex justify-end mt-4">
        <button onClick={handleSave} className="btn btn-primary" style={{ padding: '0 40px', height: '48px', fontSize: '16px' }} disabled={saving}>
          {saving ? "Saving..." : "Save Dynamic Test"}
        </button>
      </div>

    </div>
  );
}
