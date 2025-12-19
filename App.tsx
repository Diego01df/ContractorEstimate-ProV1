
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Trash2, Save, Download, FileText, Settings, 
  MapPin, Search,
  Edit2, ChevronDown, ChevronRight, Calculator,
  X, Check, PenTool, ClipboardList,
  Loader2, Table, FileEdit, LayoutPanelLeft, ScrollText,
  Sparkles, Wand2, Eye, Printer, FolderOpen, DoorOpen,
  TrendingUp, Camera, Image as ImageIcon,
  ArrowRight, Upload, ShieldCheck, Zap, Briefcase
} from 'lucide-react';
import { Project, Room, LineItem, CATEGORIES, DEFAULT_ROOMS, PAYMENT_TERMS, CATEGORY_DESCRIPTIONS } from './types';
import * as geminiService from './services/geminiService';
import * as exportService from './services/exportService';

// --- Helper Components ---

const Modal = ({ title, onClose, children, maxWidth = "max-w-3xl" }: { title: string, onClose: () => void, children: React.ReactNode, maxWidth?: string }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
    <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto border border-gray-100`}>
      <div className="flex justify-between items-center p-6 border-b border-gray-100">
        <h3 className="text-xl font-bold text-slate-800">{title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 hover:bg-gray-100 p-2 rounded-full">
            <X size={20} />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

// --- Image Processing Utility ---

const resizeAndCropToSquare = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const size = 600; // Target square resolution
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject('No context');

                let sx, sy, sWidth, sHeight;
                if (img.width > img.height) {
                    sHeight = img.height;
                    sWidth = img.height;
                    sx = (img.width - img.height) / 2;
                    sy = 0;
                } else {
                    sWidth = img.width;
                    sHeight = img.width;
                    sx = 0;
                    sy = (img.height - img.width) / 2;
                }

                ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, size, size);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    });
};

// --- Sub Components ---

interface RoomCardProps {
    room: Room;
    onUpdate: (r: Room) => void;
    onDelete: () => void;
    projectZip: string;
    apiKey: string;
}

const RoomCard: React.FC<RoomCardProps> = ({ room, onUpdate, onDelete, projectZip }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [activeSubTab, setActiveSubTab] = useState<'items' | 'scope'>('items');
    const [showAddItem, setShowAddItem] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState(room.name);
    const photoInputRef = useRef<HTMLInputElement>(null);
    
    const [editingItemIds, setEditingItemIds] = useState<Set<string>>(new Set());
    const [newItem, setNewItem] = useState<Partial<LineItem>>({ 
        category: CATEGORIES[0], 
        description: '',
        quantity: 1, 
        unit: 'ea', 
        unitPrice: 0, 
        laborRate: 0, 
        ecoProfit: 20, 
        markup: 0, 
        paymentDue: PAYMENT_TERMS[0]
    });

    const calcItemTotal = (item: LineItem) => {
        const base = (item.quantity * item.unitPrice) + (item.quantity * (item.laborRate || 0));
        const profit = base * ((item.ecoProfit || 0) / 100);
        return base + profit + (item.markup || 0);
    };

    const roomTotal = room.items.reduce((acc, item) => acc + calcItemTotal(item), 0);

    const toggleEdit = (id: string) => {
        const newSet = new Set(editingItemIds);
        if (newSet.has(id)) {
            newSet.delete(id); 
        } else {
            newSet.add(id); 
        }
        setEditingItemIds(newSet);
    };

    const handleSaveName = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (tempName.trim()) {
            onUpdate({ ...room, name: tempName.trim() });
            setIsEditingName(false);
        }
    };

    const handleAddItem = () => {
        const item: LineItem = {
            id: crypto.randomUUID(),
            category: newItem.category!,
            description: newItem.description || CATEGORY_DESCRIPTIONS[newItem.category!] || '',
            unit: newItem.unit!,
            quantity: Number(newItem.quantity),
            unitPrice: Number(newItem.unitPrice), 
            laborRate: Number(newItem.laborRate), 
            ecoProfit: Number(newItem.ecoProfit || 20),
            markup: Number(newItem.markup), 
            notes: '',
            paymentDue: newItem.paymentDue || PAYMENT_TERMS[0]
        };
        onUpdate({ ...room, items: [...room.items, item] });
        setShowAddItem(false);
        setNewItem({ 
            category: CATEGORIES[0], 
            description: '',
            quantity: 1, 
            unit: 'ea', 
            unitPrice: 0, 
            laborRate: 0,
            ecoProfit: 20,
            markup: 0,
            paymentDue: PAYMENT_TERMS[0]
        });
    };

    const handleDeleteItem = (id: string) => {
        onUpdate({ ...room, items: room.items.filter(i => i.id !== id) });
    };

    const handleUpdateItem = (id: string, updates: Partial<LineItem>) => {
        onUpdate({
            ...room,
            items: room.items.map(i => i.id === id ? { ...i, ...updates } : i)
        });
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const resized = await resizeAndCropToSquare(file);
                onUpdate({ ...room, photo: resized });
            } catch (err) {
                console.error("Photo error", err);
            }
        }
    };

    const handleAnalyzeScope = async () => {
        if (!room.scopeOfWork) return;
        setIsAnalyzing(true);
        try {
            const items = await geminiService.analyzeScopeAndGenerateItems(room.scopeOfWork, room.name, projectZip);
            if (items && items.length > 0) {
                const newItems = items.map((it: any) => ({
                    ...it,
                    id: crypto.randomUUID(),
                    ecoProfit: 20
                }));
                onUpdate({ ...room, items: [...room.items, ...newItems] });
                setActiveSubTab('items');
            }
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="p-4 bg-slate-50 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <button onClick={() => setIsExpanded(!isExpanded)} className="text-gray-500 hover:text-slate-800 transition-colors">
                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </button>
                    
                    <div className="flex items-center gap-2">
                        {room.photo ? (
                            <div className="relative group/photo cursor-pointer" onClick={() => photoInputRef.current?.click()}>
                                <img src={room.photo} className="w-10 h-10 rounded-lg object-cover border border-gray-200" alt="Room" />
                                <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover/photo:opacity-100 flex items-center justify-center transition-opacity">
                                    <Camera size={14} className="text-white" />
                                </div>
                            </div>
                        ) : (
                            <button 
                                onClick={() => photoInputRef.current?.click()}
                                className="w-10 h-10 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-slate-600 hover:border-gray-400 transition-all"
                                title="Add space photo"
                            >
                                <Camera size={18} />
                            </button>
                        )}
                        <input type="file" ref={photoInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
                    </div>

                    {isEditingName ? (
                        <form onSubmit={handleSaveName} className="flex items-center gap-2">
                            <input 
                                autoFocus
                                className="bg-white border border-gray-200 rounded px-2 py-1 text-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900"
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                onBlur={() => handleSaveName()}
                            />
                            <button type="submit" className="text-green-600 hover:text-green-700">
                                <Check size={20} />
                            </button>
                        </form>
                    ) : (
                        <div className="flex items-center gap-2 group">
                            <h4 className="font-bold text-slate-800 text-lg">{room.name}</h4>
                            <button 
                                onClick={() => setIsEditingName(true)}
                                className="text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Edit2 size={16} />
                            </button>
                        </div>
                    )}
                    
                    <span className="bg-white px-2 py-0.5 rounded-full text-xs font-semibold text-slate-500 border border-gray-200">
                        {room.items.length} items
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-xs text-gray-500 uppercase tracking-wider font-bold">Room Total</div>
                        <div className="text-lg font-black text-slate-900">${roomTotal.toLocaleString()}</div>
                    </div>
                    <button onClick={onDelete} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="p-4">
                    <div className="flex gap-1 mb-6 bg-gray-100/50 p-1 rounded-xl w-fit">
                        <button 
                            onClick={() => setActiveSubTab('items')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeSubTab === 'items' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Table size={16} />
                            Line Items
                        </button>
                        <button 
                            onClick={() => setActiveSubTab('scope')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeSubTab === 'scope' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <ScrollText size={16} />
                            Scope of Work
                        </button>
                    </div>

                    {activeSubTab === 'items' ? (
                        <div className="space-y-4">
                            <div className="rounded-lg border border-gray-100 overflow-hidden">
                                <table className="w-full text-left border-collapse table-fixed">
                                    <thead className="bg-slate-50 text-slate-600 text-[9px] uppercase tracking-wider font-bold border-b border-gray-100">
                                        <tr>
                                            <th className="p-2 w-[12%]">Category</th>
                                            <th className="p-2 w-[22%]">Description</th>
                                            <th className="p-2 w-[8%]">Qty/U</th>
                                            <th className="p-2 w-[7%]">Mat $</th>
                                            <th className="p-2 w-[7%]">Lab $</th>
                                            <th className="p-2 w-[7%] text-green-700">ECO %</th>
                                            <th className="p-2 w-[14%]">Payment</th>
                                            <th className="p-2 w-[9%] text-right">Total</th>
                                            <th className="p-2 w-[14%] text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {room.items.map(item => {
                                            const total = calcItemTotal(item);
                                            const isEditing = editingItemIds.has(item.id);
                                            return (
                                                <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-2 align-top">
                                                        {isEditing ? (
                                                            <select 
                                                                className="w-full bg-white border border-gray-200 rounded p-1 text-[9px] focus:ring-2 focus:ring-slate-900 outline-none appearance-none"
                                                                value={item.category}
                                                                onChange={(e) => handleUpdateItem(item.id, { category: e.target.value })}
                                                            >
                                                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                            </select>
                                                        ) : (
                                                            <div className="font-bold text-slate-800 text-[9px] truncate" title={item.category}>{item.category}</div>
                                                        )}
                                                    </td>
                                                    <td className="p-2 align-top">
                                                        {isEditing ? (
                                                            <textarea 
                                                                rows={2}
                                                                className="w-full bg-white border border-gray-200 rounded p-1 text-[9px] focus:ring-2 focus:ring-slate-900 outline-none resize-none"
                                                                value={item.description}
                                                                onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                                                                placeholder="Details..."
                                                            />
                                                        ) : (
                                                            <div className="text-slate-600 text-[9px] leading-relaxed break-words line-clamp-2" title={item.description}>{item.description}</div>
                                                        )}
                                                    </td>
                                                    <td className="p-2 align-top">
                                                        {isEditing ? (
                                                            <div className="flex flex-col gap-1">
                                                                <input 
                                                                    type="number" className="w-full bg-white border border-gray-200 rounded p-1 text-[9px]"
                                                                    value={item.quantity} onChange={(e) => handleUpdateItem(item.id, { quantity: Number(e.target.value) })}
                                                                />
                                                                <input 
                                                                    type="text" className="w-full bg-white border border-gray-200 rounded p-1 text-[8px]"
                                                                    value={item.unit} onChange={(e) => handleUpdateItem(item.id, { unit: e.target.value })}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="text-slate-600 text-[9px] font-medium truncate">{item.quantity} {item.unit}</div>
                                                        )}
                                                    </td>
                                                    <td className="p-2 align-top">
                                                        {isEditing ? (
                                                            <input 
                                                                type="number" className="w-full bg-white border border-gray-200 rounded p-1 text-[9px]"
                                                                value={item.unitPrice} onChange={(e) => handleUpdateItem(item.id, { unitPrice: Number(e.target.value) })}
                                                            />
                                                        ) : (
                                                            <div className="text-slate-600 text-[9px]">${item.unitPrice.toFixed(0)}</div>
                                                        )}
                                                    </td>
                                                    <td className="p-2 align-top">
                                                        {isEditing ? (
                                                            <input 
                                                                type="number" className="w-full bg-white border border-gray-200 rounded p-1 text-[9px]"
                                                                value={item.laborRate} onChange={(e) => handleUpdateItem(item.id, { laborRate: Number(e.target.value) })}
                                                            />
                                                        ) : (
                                                            <div className="text-slate-600 text-[9px]">${item.laborRate?.toFixed(0)}</div>
                                                        )}
                                                    </td>
                                                    <td className="p-2 align-top">
                                                        <div className="flex items-center gap-0.5">
                                                            <input 
                                                                type="number" 
                                                                className="w-full bg-white border border-green-100 rounded p-0.5 text-[9px] text-green-700 font-bold focus:ring-1 focus:ring-green-500 outline-none"
                                                                value={item.ecoProfit} 
                                                                onChange={(e) => handleUpdateItem(item.id, { ecoProfit: Number(e.target.value) })}
                                                            />
                                                            <span className="text-[7px] text-green-500 font-bold">%</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-2 align-top">
                                                        {isEditing ? (
                                                            <select 
                                                                className="w-full bg-white border border-gray-200 rounded p-1 text-[9px] focus:ring-2 focus:ring-slate-900 outline-none appearance-none"
                                                                value={item.paymentDue}
                                                                onChange={(e) => handleUpdateItem(item.id, { paymentDue: e.target.value })}
                                                            >
                                                                {PAYMENT_TERMS.map(term => <option key={term} value={term}>{term}</option>)}
                                                            </select>
                                                        ) : (
                                                            <div className="text-slate-500 text-[8px] leading-tight font-medium uppercase line-clamp-2">{item.paymentDue}</div>
                                                        )}
                                                    </td>
                                                    <td className="p-2 text-right align-top">
                                                        <div className="font-black text-slate-900 text-[10px] truncate">${total.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                                                    </td>
                                                    <td className="p-2 align-top">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button 
                                                                onClick={() => toggleEdit(item.id)} 
                                                                className={`flex items-center gap-1 p-1 rounded transition-all ${isEditing ? 'bg-green-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
                                                                title={isEditing ? 'Save changes' : 'Edit item'}
                                                            >
                                                                {isEditing ? <Check size={14} /> : <Edit2 size={14} />}
                                                                <span className="text-[8px] font-bold uppercase">{isEditing ? 'Save' : 'Edit'}</span>
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteItem(item.id)} 
                                                                className="flex items-center gap-1 p-1 rounded text-red-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                                                title="Delete item"
                                                            >
                                                                <Trash2 size={14} />
                                                                <span className="text-[8px] font-bold uppercase">Del</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            
                            {!showAddItem ? (
                                <button 
                                    onClick={() => setShowAddItem(true)}
                                    className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors w-full justify-center p-3 border-2 border-dashed border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50"
                                >
                                    <Plus size={16} /> Add Line Item
                                </button>
                            ) : (
                                <div className="bg-white p-4 rounded-xl border border-slate-200 animate-in slide-in-from-top-2 duration-200 shadow-sm">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                        <div className="md:col-span-4">
                                            <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Category</label>
                                            <select 
                                                className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-slate-900 outline-none appearance-none"
                                                value={newItem.category}
                                                onChange={(e) => {
                                                    const cat = e.target.value;
                                                    setNewItem({ 
                                                        ...newItem, 
                                                        category: cat,
                                                        description: CATEGORY_DESCRIPTIONS[cat] || '' 
                                                    });
                                                }}
                                            >
                                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div className="md:col-span-6">
                                            <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Work Description</label>
                                            <input 
                                                className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-slate-900 outline-none"
                                                value={newItem.description}
                                                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                                                placeholder="Describe specific work..."
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[9px] font-bold text-green-600 mb-1 uppercase tracking-wider">ECO Profit %</label>
                                            <input 
                                                type="number" className="w-full bg-white border border-green-200 rounded-lg p-2 text-xs text-green-700 font-bold focus:ring-2 focus:ring-green-500 outline-none"
                                                value={newItem.ecoProfit} onChange={(e) => setNewItem({ ...newItem, ecoProfit: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Payment Due</label>
                                            <select 
                                                className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-slate-900 outline-none appearance-none"
                                                value={newItem.paymentDue}
                                                onChange={(e) => setNewItem({ ...newItem, paymentDue: e.target.value })}
                                            >
                                                {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Qty / Unit</label>
                                            <div className="flex gap-1">
                                                <input 
                                                    type="number" className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs"
                                                    value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
                                                />
                                                <input 
                                                    type="text" className="w-20 bg-white border border-gray-200 rounded-lg p-2 text-[10px]"
                                                    value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Material $</label>
                                            <input 
                                                type="number" className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs"
                                                value={newItem.unitPrice} onChange={(e) => setNewItem({ ...newItem, unitPrice: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Labor $</label>
                                            <input 
                                                type="number" className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs"
                                                value={newItem.laborRate} onChange={(e) => setNewItem({ ...newItem, laborRate: Number(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-4 flex justify-end gap-3">
                                        <button onClick={() => setShowAddItem(false)} className="px-4 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700">Cancel</button>
                                        <button onClick={handleAddItem} className="bg-slate-900 text-white px-5 py-1.5 rounded-lg text-xs font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all flex items-center gap-2">
                                            <Plus size={14} /> Save Item
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="relative">
                                <textarea 
                                    className="w-full bg-white border border-gray-200 rounded-xl p-4 text-sm min-h-[160px] focus:ring-2 focus:ring-slate-900 outline-none placeholder:text-gray-300 shadow-sm"
                                    placeholder={`Describe the work to be done in the ${room.name}...`}
                                    value={room.scopeOfWork}
                                    onChange={(e) => onUpdate({ ...room, scopeOfWork: e.target.value })}
                                />
                                <div className="absolute bottom-4 right-4 flex gap-2">
                                    <button 
                                        disabled={!room.scopeOfWork || isAnalyzing}
                                        onClick={handleAnalyzeScope}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                        Analyze for {room.name}
                                    </button>
                                </div>
                            </div>
                            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex gap-3">
                                <div className="p-2 bg-white rounded-lg h-fit shadow-sm">
                                    <Wand2 size={18} className="text-indigo-600" />
                                </div>
                                <div>
                                    <h5 className="font-bold text-indigo-900 text-sm">Smart Space Interpretation</h5>
                                    <p className="text-indigo-700 text-xs mt-1 leading-relaxed">
                                        Independent AI analysis for "{room.name}".
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// --- Landing Page Component ---

const LandingPage: React.FC<{ 
    onStartNew: () => void, 
    onImport: (e: React.ChangeEvent<HTMLInputElement>) => void 
}> = ({ onStartNew, onImport }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 overflow-hidden relative">
            {/* Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-[120px] -z-10 animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-green-50 rounded-full blur-[120px] -z-10 animate-pulse delay-1000"></div>

            <div className="max-w-4xl w-full text-center space-y-12 animate-in fade-in zoom-in duration-700">
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-full text-sm font-black tracking-widest uppercase shadow-xl mb-4">
                        <PenTool size={16} />
                        ContractorEstimate Pro
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter leading-none">
                        Precision Estimates <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-green-500">
                            Powered by AI.
                        </span>
                    </h1>
                    <p className="text-slate-500 text-lg md:text-xl font-medium max-w-2xl mx-auto leading-relaxed">
                        Transform your construction project management. Professional interior remodel tools with automated pricing, scope analysis, and instant documentation.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8">
                    {/* New Project Card */}
                    <button 
                        onClick={onStartNew}
                        className="group relative bg-white border-2 border-slate-100 p-8 rounded-[2rem] text-left hover:border-green-400 hover:shadow-2xl hover:shadow-green-100 transition-all duration-300"
                    >
                        <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-green-600 group-hover:text-white transition-colors">
                            <Plus size={32} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-2">New Estimate</h3>
                        <p className="text-slate-500 text-sm font-medium leading-relaxed mb-6">
                            Start a fresh project from scratch. Utilize our smart space interpretation and category systems.
                        </p>
                        <div className="flex items-center gap-2 font-black text-green-600 group-hover:translate-x-2 transition-transform">
                            Let's Build <ArrowRight size={20} />
                        </div>
                    </button>

                    {/* Import Project Card */}
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="group relative bg-white border-2 border-slate-100 p-8 rounded-[2rem] text-left hover:border-blue-400 hover:shadow-2xl hover:shadow-blue-100 transition-all duration-300"
                    >
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Upload size={32} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-2">Import Project</h3>
                        <p className="text-slate-500 text-sm font-medium leading-relaxed mb-6">
                            Resume your work by uploading an existing project file. Supports all ContractorEstimate Pro .json formats.
                        </p>
                        <div className="flex items-center gap-2 font-black text-blue-600 group-hover:translate-x-2 transition-transform">
                            Open File <FolderOpen size={20} />
                        </div>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={onImport} accept=".json" className="hidden" />
                </div>

                {/* Trust Badges / Features */}
                <div className="pt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="flex flex-col items-center gap-2">
                        <div className="p-3 bg-slate-50 rounded-full text-slate-400">
                            <ShieldCheck size={20} />
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Confidential Reporting</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <div className="p-3 bg-slate-50 rounded-full text-slate-400">
                            <Zap size={20} />
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Real-time AI Pricing</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <div className="p-3 bg-slate-50 rounded-full text-slate-400">
                            <Briefcase size={20} />
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">White-Label Exports</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main App Component ---

const App: React.FC = () => {
    const [project, setProject] = useState<Project | null>(null);
    const [currentView, setCurrentView] = useState<'landing' | 'editor'>('landing');
    const [isLoading, setIsLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const saved = localStorage.getItem('current_project');
        if (saved) {
            setProject(JSON.parse(saved));
            setCurrentView('editor');
        }
    }, []);

    useEffect(() => {
        if (project) {
            localStorage.setItem('current_project', JSON.stringify(project));
        }
    }, [project]);

    const startNewProject = () => {
        const newProj: Project = {
            id: crypto.randomUUID(),
            title: "Untitled Estimate",
            address: { street: "", city: "", state: "", zip: "" },
            rooms: [],
            contingencyPct: 10,
            taxPct: 0,
            discountPct: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            notes: ""
        };
        setProject(newProj);
        setCurrentView('editor');
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                setProject(json);
                setCurrentView('editor');
            } catch (err) {
                alert("Error: Invalid project file.");
            }
        };
        reader.readAsText(file);
    };

    const addRoom = (name: string = "New Space") => {
        if (!project) return;
        const newRoom: Room = {
            id: crypto.randomUUID(),
            name,
            items: [],
            scopeOfWork: ""
        };
        setProject({ ...project, rooms: [...project.rooms, newRoom] });
    };

    const updateRoom = (updatedRoom: Room) => {
        if (!project) return;
        setProject({
            ...project,
            rooms: project.rooms.map(r => r.id === updatedRoom.id ? updatedRoom : r)
        });
    };

    const deleteRoom = (id: string) => {
        if (!project) return;
        setProject({
            ...project,
            rooms: project.rooms.filter(r => r.id !== id)
        });
    };

    const handleValidateAddress = async (q: string) => {
        if (!project) return;
        setIsLoading(true);
        const addr = await geminiService.validateAddress(q);
        if (addr) {
            setProject({ ...project, address: addr });
        }
        setIsLoading(false);
    };

    const saveProjectAsJson = () => {
        if (!project) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${project.title.replace(/\s+/g, '_')}_data.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    if (currentView === 'landing') {
        return <LandingPage onStartNew={startNewProject} onImport={handleImport} />;
    }

    if (!project) return null;

    const calcItemTotal = (item: LineItem) => {
        const base = (item.quantity * item.unitPrice) + (item.quantity * (item.laborRate || 0));
        const profit = base * ((item.ecoProfit || 0) / 100);
        return base + profit + (item.markup || 0);
    };

    const subtotal = project.rooms.reduce((acc, r) => 
        acc + r.items.reduce((sum, i) => sum + calcItemTotal(i), 0), 0
    );

    const totalEcoProfitValue = project.rooms.reduce((acc, r) => 
        acc + r.items.reduce((sum, i) => {
            const base = (i.quantity * i.unitPrice) + (i.quantity * (i.laborRate || 0));
            return sum + (base * ((i.ecoProfit || 0) / 100));
        }, 0), 0
    );

    const contingency = subtotal * (project.contingencyPct / 100);
    const tax = (subtotal + contingency) * (project.taxPct / 100);
    const grossTotal = subtotal + contingency + tax;
    const discount = grossTotal * (project.discountPct / 100);
    const grandTotal = grossTotal - discount;

    const formatPrice = (n: number) => `$${n.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setCurrentView('landing')} className="bg-slate-900 p-2.5 rounded-xl shadow-lg hover:scale-105 transition-transform">
                            <PenTool className="text-white" size={24} />
                        </button>
                        <div>
                            <input 
                                className="text-xl font-black bg-transparent border-none focus:ring-0 p-0 text-slate-800"
                                value={project.title}
                                onChange={(e) => setProject({ ...project, title: e.target.value })}
                                placeholder="Project Title"
                            />
                            <div className="flex items-center gap-1.5 text-slate-400 text-sm font-medium mt-0.5">
                                <MapPin size={14} />
                                {project.address.street ? (
                                    <span>{project.address.street}, {project.address.city}</span>
                                ) : (
                                    <button onClick={() => setShowSettings(true)} className="hover:text-slate-600">Add Address</button>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => addRoom()}
                            className="bg-green-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-black text-sm shadow-xl shadow-green-100 hover:bg-green-700 transition-all hover:scale-[1.02] active:scale-95 duration-200"
                        >
                            <Plus size={20} /> Add New Room
                        </button>
                        <button 
                            onClick={() => setShowPreview(true)}
                            className="p-3 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl flex items-center gap-2 font-bold text-sm transition-colors"
                        >
                            <Eye size={20} /> Preview
                        </button>
                        <button onClick={() => setShowSettings(true)} className="p-3 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl">
                            <Settings size={22} />
                        </button>
                        <div className="h-8 w-px bg-gray-100 mx-1" />
                        <div className="dropdown relative group">
                            <button className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-xl hover:bg-slate-800 transition-all">
                                <Download size={18} />
                                Export
                            </button>
                            <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all py-2 z-50">
                                <button onClick={() => exportService.exportPDF(project)} className="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3">
                                    <FileText size={18} className="text-red-500" /> PDF
                                </button>
                                <button onClick={() => exportService.exportExcel(project)} className="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3">
                                    <Table size={18} className="text-green-600" /> Excel
                                </button>
                                <button onClick={() => exportService.exportWord(project)} className="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3">
                                    <FileEdit size={18} className="text-blue-500" /> Word
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="text-xs font-bold text-slate-400 uppercase mb-1 tracking-widest">Subtotal (Inc. ECO Profit)</div>
                            <div className="text-2xl font-black text-slate-900">{formatPrice(subtotal)}</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="text-xs font-bold text-slate-400 uppercase mb-1 tracking-widest">Grand Total Estimate</div>
                            <div className="text-2xl font-black text-slate-900">{formatPrice(grandTotal)}</div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                <LayoutPanelLeft className="text-slate-400" />
                                Project Areas
                            </h2>
                        </div>

                        {project.rooms.map(room => (
                            <RoomCard 
                                key={room.id}
                                room={room}
                                onUpdate={updateRoom}
                                onDelete={() => deleteRoom(room.id)}
                                projectZip={project.address.zip}
                                apiKey={process.env.API_KEY || ""}
                            />
                        ))}

                        <button 
                            onClick={() => addRoom()}
                            className="w-full py-8 bg-white border-4 border-dashed border-green-200 rounded-3xl flex items-center justify-center gap-4 text-green-600 font-black text-xl hover:bg-green-50 hover:border-green-400 transition-all shadow-md group active:scale-[0.99]"
                        >
                            <Plus size={32} className="group-hover:scale-110 transition-transform" /> Add New Project Space
                        </button>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-8">
                    <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl sticky top-28">
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2 opacity-80 uppercase tracking-widest">
                            <Calculator size={20} />
                            Project Logic
                        </h3>
                        
                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-400 font-bold">Contingency %</span>
                                <input 
                                    type="number" className="w-16 bg-white border-none rounded p-1 text-sm text-center text-slate-900 focus:ring-2 focus:ring-green-500 outline-none font-bold"
                                    value={project.contingencyPct} onChange={(e) => setProject({...project, contingencyPct: Number(e.target.value)})}
                                />
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-400 font-bold">Tax %</span>
                                <input 
                                    type="number" className="w-16 bg-white border-none rounded p-1 text-sm text-center text-slate-900 focus:ring-2 focus:ring-green-500 outline-none font-bold"
                                    value={project.taxPct} onChange={(e) => setProject({...project, taxPct: Number(e.target.value)})}
                                />
                            </div>
                            <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-800">
                                <div className="flex items-center gap-2 text-green-400">
                                    <TrendingUp size={16} />
                                    <span className="font-bold">Total ECO Profit</span>
                                </div>
                                <span className="text-green-400 font-black text-lg">{formatPrice(totalEcoProfitValue)}</span>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-800">
                            <div className="text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">Total with Internal Profit</div>
                            <div className="text-4xl font-black text-green-400">{formatPrice(grandTotal)}</div>
                        </div>

                        <div className="mt-10">
                            <button 
                                onClick={saveProjectAsJson}
                                className="w-full bg-green-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-green-900/40"
                            >
                                <Save size={18} /> Download Project (.JSON)
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                            <ClipboardList size={16} />
                            Internal Notes
                        </h3>
                        <textarea 
                            className="w-full bg-white border border-gray-100 rounded-xl p-3 text-sm min-h-[120px] focus:ring-2 focus:ring-slate-900 outline-none placeholder:text-gray-300 resize-none shadow-sm"
                            placeholder="Internal project coordination notes..."
                            value={project.notes}
                            onChange={(e) => setProject({ ...project, notes: e.target.value })}
                        />
                    </div>
                </div>
            </main>

            {/* Project Settings Modal */}
            {showSettings && (
                <Modal title="Project Settings" onClose={() => setShowSettings(false)}>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Address Search</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input 
                                        className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                                        placeholder="Address for zip matching..."
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleValidateAddress((e.target as HTMLInputElement).value);
                                        }}
                                    />
                                </div>
                                <button 
                                    className="bg-slate-900 text-white px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors"
                                    onClick={(e) => {
                                        const input = e.currentTarget.previousElementSibling?.querySelector('input');
                                        if (input) handleValidateAddress(input.value);
                                    }}
                                    disabled={isLoading}
                                >
                                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Street</label>
                                <input 
                                    className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm"
                                    value={project.address.street}
                                    onChange={(e) => setProject({ ...project, address: { ...project.address, street: e.target.value }})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">City</label>
                                <input 
                                    className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm"
                                    value={project.address.city}
                                    onChange={(e) => setProject({ ...project, address: { ...project.address, city: e.target.value }})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">State</label>
                                    <input 
                                        className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm"
                                        value={project.address.state}
                                        onChange={(e) => setProject({ ...project, address: { ...project.address, state: e.target.value }})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">ZIP</label>
                                    <input 
                                        className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm"
                                        value={project.address.zip}
                                        onChange={(e) => setProject({ ...project, address: { ...project.address, zip: e.target.value }})}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <button onClick={() => setShowSettings(false)} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg">
                                Done
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Report Preview Modal */}
            {showPreview && (
                <Modal title="Report Preview (Client Facing)" onClose={() => setShowPreview(false)} maxWidth="max-w-5xl">
                    <div className="bg-slate-50 p-8 rounded-xl border border-gray-200 shadow-inner min-h-[800px] flex flex-col font-serif">
                        <div className="bg-white p-12 shadow-2xl flex-1 mx-auto w-full max-w-[800px] text-slate-800">
                            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8">
                                <div>
                                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2 uppercase">Estimate</h1>
                                    <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Remodel & Renovation Package</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-slate-900 text-lg">{project.title}</p>
                                    <p className="text-slate-500 text-sm">{project.address.street}</p>
                                    <p className="text-slate-500 text-sm">{project.address.city}, {project.address.state} {project.address.zip}</p>
                                    <p className="text-slate-400 text-xs mt-2 italic">Date: {new Date().toLocaleDateString()}</p>
                                </div>
                            </div>

                            <div className="space-y-12">
                                {project.rooms.map(room => (
                                    <div key={room.id}>
                                        <div className="flex items-center gap-4 border-b border-slate-200 pb-2 mb-4">
                                            {room.photo && (
                                                <img src={room.photo} className="w-16 h-16 rounded object-cover border border-slate-100 shadow-sm" alt={room.name} />
                                            )}
                                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide">{room.name}</h2>
                                        </div>
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                                <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-y border-slate-100">
                                                    <th className="py-2 px-3">Category</th>
                                                    <th className="py-2 px-3">Description</th>
                                                    <th className="py-2 px-3">Payment Due</th>
                                                    <th className="py-2 px-3 text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {room.items.map(item => {
                                                    const itemTotal = calcItemTotal(item);
                                                    return (
                                                        <tr key={item.id} className="border-b border-slate-50 last:border-0">
                                                            <td className="py-3 px-3 font-bold text-slate-800 text-xs align-top">{item.category}</td>
                                                            <td className="py-3 px-3 text-slate-500 text-xs italic align-top leading-relaxed">{item.description}</td>
                                                            <td className="py-3 px-3 text-slate-500 text-[10px] font-medium uppercase align-top">{item.paymentDue}</td>
                                                            <td className="py-3 px-3 text-right font-bold text-slate-900 text-xs align-top">{formatPrice(itemTotal)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr className="border-t-2 border-slate-100 font-bold">
                                                    <td colSpan={3} className="py-3 px-3 text-right text-xs text-slate-400">Space Subtotal:</td>
                                                    <td className="py-3 px-3 text-right text-sm text-slate-900">
                                                        {formatPrice(room.items.reduce((acc, i) => acc + calcItemTotal(i), 0))}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-16 pt-8 border-t-2 border-slate-900 flex justify-end">
                                <div className="w-full max-w-[350px] space-y-3">
                                    <div className="flex justify-between text-slate-500 text-sm">
                                        <span>Subtotal (Inclusive of all Fees)</span>
                                        <span className="font-bold">{formatPrice(subtotal)}</span>
                                    </div>
                                    {project.contingencyPct > 0 && (
                                        <div className="flex justify-between text-slate-500 text-sm italic">
                                            <span>Reserve Contingency ({project.contingencyPct}%)</span>
                                            <span>{formatPrice(contingency)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-slate-500 text-sm">
                                        <span>Estimated Sales Tax</span>
                                        <span>{formatPrice(tax)}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-900 text-2xl font-black pt-4 border-t-2 border-slate-200">
                                        <span>GRAND TOTAL</span>
                                        <span className="text-green-700">{formatPrice(grandTotal)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-20 text-[10px] text-slate-300 italic text-center">
                                * Confidential Document. Pricing includes materials, professional labor, and administrative overhead. Profit margins are integrated and not itemized.
                            </div>
                        </div>
                    </div>
                    <div className="mt-8 flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-3 text-slate-500 text-xs font-bold">
                            <Check className="text-green-500" size={16} />
                            ECO Profit and Area Photos are processed for professional presentation.
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setShowPreview(false)} className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors">Close Preview</button>
                            <button 
                                onClick={() => {
                                    exportService.exportPDF(project);
                                    setShowPreview(false);
                                }} 
                                className="bg-slate-900 text-white px-8 py-2 rounded-xl text-sm font-black shadow-lg hover:bg-slate-800 flex items-center gap-2"
                            >
                                <Download size={18} /> Export Final PDF
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default App;
