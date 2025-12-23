
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Trash2, Save, Download, FileText, Settings, 
  MapPin, Search,
  Edit2, ChevronDown, ChevronRight, Calculator,
  X, Check, PenTool, ClipboardList,
  Loader2, Table, FileEdit, LayoutPanelLeft, ScrollText,
  Sparkles, Wand2, Eye, Printer, FolderOpen, DoorOpen,
  TrendingUp, Camera, Image as ImageIcon,
  ArrowRight, Upload, ShieldCheck, Zap, Briefcase, History
} from 'lucide-react';
import { Project, Room, LineItem, CATEGORIES, DEFAULT_ROOMS, PAYMENT_TERMS, CATEGORY_DESCRIPTIONS } from './types';
import * as geminiService from './services/geminiService';
import * as exportService from './services/exportService';

// --- Helper Components ---

const Modal: React.FC<{ 
  title: string; 
  onClose: () => void; 
  children: React.ReactNode; 
  maxWidth?: string; 
}> = ({ title, onClose, children, maxWidth = "max-w-3xl" }) => (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
    <div className={`bg-white rounded-[2rem] shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto border border-slate-100 animate-in zoom-in-95 duration-200`}>
      <div className="flex justify-between items-center p-6 border-b border-slate-50">
        <h3 className="text-xl font-bold text-slate-800">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 hover:bg-slate-100 p-2 rounded-full">
            <X size={20} />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

// --- Sub Components ---

interface RoomCardProps {
    room: Room;
    onUpdate: (r: Room) => void;
    onDelete: () => void;
    projectZip: string;
}

const RoomCard: React.FC<RoomCardProps> = ({ room, onUpdate, onDelete, projectZip }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [activeSubTab, setActiveSubTab] = useState<'items' | 'scope'>('items');
    const [showAddItem, setShowAddItem] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState(room.name);
    
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
            markup: Number(newItem.markup || 0), 
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

    const handleAnalyzeScope = async () => {
        if (!room.scopeOfWork) return;
        setIsAnalyzing(true);
        try {
            const items = await geminiService.analyzeScopeAndGenerateItems(room.scopeOfWork, room.name, projectZip);
            if (items && items.length > 0) {
                const newItems = items.map((it: any) => ({
                    ...it,
                    id: crypto.randomUUID()
                }));
                onUpdate({ ...room, items: [...room.items, ...newItems] });
                setActiveSubTab('items');
            }
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden mb-8 transition-all hover:shadow-xl hover:border-brand-200/50">
            <div className="p-6 bg-slate-50/50 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)} 
                        className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200 text-slate-400 hover:text-slate-900 transition-all hover:scale-105 active:scale-95"
                    >
                        {isExpanded ? <ChevronDown size={24} /> : <ChevronRight size={24} />}
                    </button>
                    
                    {isEditingName ? (
                        <form onSubmit={handleSaveName} className="flex items-center gap-2">
                            <input 
                                autoFocus
                                className="bg-white border border-brand-300 rounded-2xl px-5 py-3 text-xl font-bold text-slate-900 outline-none focus:ring-4 focus:ring-brand-500/10 transition-all"
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                onBlur={() => handleSaveName()}
                            />
                            <button type="submit" className="text-white bg-green-600 p-3 rounded-2xl shadow-xl shadow-green-100 hover:bg-green-700 transition-all">
                                <Check size={20} strokeWidth={3} />
                            </button>
                        </form>
                    ) : (
                        <div className="flex items-center gap-5 group">
                            <h4 className="font-extrabold text-slate-900 text-2xl tracking-tighter leading-none">{room.name}</h4>
                            <button 
                                onClick={() => setIsEditingName(true)}
                                className="text-slate-300 hover:text-brand-600 opacity-0 group-hover:opacity-100 transition-all translate-y-0.5"
                            >
                                <Edit2 size={20} />
                            </button>
                        </div>
                    )}
                    
                    <div className="hidden sm:flex items-center gap-2 px-4 py-1.5 bg-brand-50 rounded-full border border-brand-100">
                        <Zap size={14} className="text-brand-500" />
                        <span className="text-[11px] font-black text-brand-700 uppercase tracking-widest leading-none pt-0.5">
                            {room.items.length} Work Items
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-10">
                    <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black mb-1.5">Area Estimated Value</div>
                        <div className="text-2xl font-black text-slate-900 tracking-tighter">${roomTotal.toLocaleString()}</div>
                    </div>
                    <button onClick={onDelete} className="text-slate-300 hover:text-red-500 p-4 hover:bg-red-50 rounded-[1.5rem] transition-all">
                        <Trash2 size={24} />
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="p-10">
                    <div className="flex gap-4 mb-12 bg-slate-100/60 p-2 rounded-2xl w-fit">
                        <button 
                            onClick={() => setActiveSubTab('items')}
                            className={`px-8 py-3.5 rounded-xl text-xs font-black flex items-center gap-3 transition-all ${activeSubTab === 'items' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            <Table size={18} />
                            ITEMIZED ESTIMATE
                        </button>
                        <button 
                            onClick={() => setActiveSubTab('scope')}
                            className={`px-8 py-3.5 rounded-xl text-xs font-black flex items-center gap-3 transition-all ${activeSubTab === 'scope' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            <ScrollText size={18} />
                            SPECIFICATIONS
                        </button>
                    </div>

                    {activeSubTab === 'items' ? (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div className="rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm bg-white">
                                <table className="w-full text-left border-collapse table-fixed">
                                    <thead className="bg-slate-50/80 text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black border-b border-slate-100">
                                        <tr>
                                            <th className="p-6 w-[20%]">Category</th>
                                            <th className="p-6 w-[30%]">Work Description</th>
                                            <th className="p-6 w-[12%]">Quantity</th>
                                            <th className="p-6 w-[12%] text-right">Unit Rate</th>
                                            <th className="p-6 w-[12%] text-right">Total</th>
                                            <th className="p-6 w-[14%] text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {room.items.map(item => {
                                            const total = calcItemTotal(item);
                                            const isEditing = editingItemIds.has(item.id);
                                            return (
                                                <tr key={item.id} className="group hover:bg-slate-50/40 transition-colors">
                                                    <td className="p-6 align-top">
                                                        {isEditing ? (
                                                            <select 
                                                                className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs focus:ring-4 focus:ring-brand-500/10 outline-none transition-all"
                                                                value={item.category}
                                                                onChange={(e) => handleUpdateItem(item.id, { category: e.target.value })}
                                                            >
                                                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                            </select>
                                                        ) : (
                                                            <div className="font-bold text-slate-900 text-xs truncate py-1 uppercase tracking-tight" title={item.category}>{item.category}</div>
                                                        )}
                                                    </td>
                                                    <td className="p-6 align-top">
                                                        {isEditing ? (
                                                            <textarea 
                                                                rows={2}
                                                                className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs focus:ring-4 focus:ring-brand-500/10 outline-none resize-none transition-all"
                                                                value={item.description}
                                                                onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                                                            />
                                                        ) : (
                                                            <div className="text-slate-500 text-xs leading-relaxed line-clamp-2 italic" title={item.description}>{item.description}</div>
                                                        )}
                                                    </td>
                                                    <td className="p-6 align-top">
                                                        <div className="text-slate-900 text-xs font-black py-1 uppercase tracking-wider">{item.quantity} <span className="text-slate-400 font-bold">{item.unit}</span></div>
                                                    </td>
                                                    <td className="p-6 text-right align-top">
                                                        <div className="text-slate-500 text-xs py-1 font-medium">${(item.unitPrice + (item.laborRate || 0)).toFixed(0)}</div>
                                                    </td>
                                                    <td className="p-6 text-right align-top">
                                                        <div className="font-black text-slate-900 text-sm py-1 tracking-tight">${total.toLocaleString()}</div>
                                                    </td>
                                                    <td className="p-6 align-top">
                                                        <div className="flex items-center justify-center gap-3">
                                                            <button 
                                                                onClick={() => toggleEdit(item.id)} 
                                                                className={`p-3 rounded-2xl transition-all ${isEditing ? 'bg-brand-600 text-white shadow-xl shadow-brand-100' : 'text-slate-300 hover:text-slate-900 hover:bg-slate-100'}`}
                                                            >
                                                                {isEditing ? <Check size={20} strokeWidth={3} /> : <Edit2 size={20} />}
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteItem(item.id)} 
                                                                className="p-3 rounded-2xl text-slate-200 hover:text-red-500 hover:bg-red-50 transition-all"
                                                            >
                                                                <Trash2 size={20} />
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
                                    className="flex items-center gap-4 text-sm font-black text-slate-300 hover:text-brand-600 transition-all w-full justify-center py-8 border-4 border-dashed border-slate-100 rounded-[2.5rem] hover:border-brand-200 hover:bg-brand-50/50 mt-8 group active:scale-[0.99]"
                                >
                                    <Plus size={24} strokeWidth={4} className="group-hover:scale-110 transition-transform" /> START NEW LINE ITEM
                                </button>
                            ) : (
                                <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] animate-in slide-in-from-top-10 duration-500 mt-8 border-brand-100 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-bl-[4rem] -z-0 opacity-40"></div>
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 relative z-10">
                                        <div className="md:col-span-4">
                                            <label className="block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-[0.2em]">Structural Category</label>
                                            <select 
                                                className="w-full bg-slate-50/50 border border-slate-200 rounded-[1.25rem] p-5 text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none transition-all"
                                                value={newItem.category}
                                                onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                                            >
                                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div className="md:col-span-8">
                                            <label className="block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-[0.2em]">Work Specification</label>
                                            <input 
                                                className="w-full bg-slate-50/50 border border-slate-200 rounded-[1.25rem] p-5 text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none transition-all"
                                                value={newItem.description}
                                                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                                                placeholder="Detail the materials and labor required..."
                                            />
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-[0.2em]">Qty & Unit</label>
                                            <div className="flex gap-4">
                                                <input 
                                                    type="number" className="w-full bg-slate-50/50 border border-slate-200 rounded-[1.25rem] p-5 text-sm font-black"
                                                    value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
                                                />
                                                <input 
                                                    type="text" className="w-32 bg-slate-50/50 border border-slate-200 rounded-[1.25rem] p-5 text-sm uppercase tracking-widest font-black text-slate-400 text-center"
                                                    value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-[0.2em]">Material $</label>
                                            <input 
                                                type="number" className="w-full bg-slate-50/50 border border-slate-200 rounded-[1.25rem] p-5 text-sm font-black"
                                                value={newItem.unitPrice} onChange={(e) => setNewItem({ ...newItem, unitPrice: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-[0.2em]">Labor $</label>
                                            <input 
                                                type="number" className="w-full bg-slate-50/50 border border-slate-200 rounded-[1.25rem] p-5 text-sm font-black"
                                                value={newItem.laborRate} onChange={(e) => setNewItem({ ...newItem, laborRate: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="block text-[10px] font-black text-green-600 mb-4 uppercase tracking-[0.2em]">Profit Margin %</label>
                                            <input 
                                                type="number" className="w-full bg-green-50/50 border border-green-200 rounded-[1.25rem] p-5 text-sm font-black text-green-700 focus:ring-4 focus:ring-green-500/10 outline-none transition-all shadow-inner"
                                                value={newItem.ecoProfit} onChange={(e) => setNewItem({ ...newItem, ecoProfit: Number(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-12 flex justify-end gap-6 relative z-10">
                                        <button onClick={() => setShowAddItem(false)} className="px-10 py-4 text-sm font-black text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-widest">CANCEL</button>
                                        <button onClick={handleAddItem} className="bg-slate-900 text-white px-12 py-4 rounded-[1.25rem] text-xs font-black shadow-2xl hover:bg-brand-600 transition-all flex items-center gap-4 tracking-[0.2em] uppercase active:scale-95">
                                            <Save size={20} strokeWidth={2.5} /> ADD LINE ITEM
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div className="relative">
                                <textarea 
                                    className="w-full bg-slate-50/50 border border-slate-200 rounded-[3rem] p-10 text-sm min-h-[300px] focus:ring-4 focus:ring-brand-500/10 outline-none placeholder:text-slate-300 shadow-inner leading-loose transition-all"
                                    placeholder={`Describe the architectural vision for ${room.name}...`}
                                    value={room.scopeOfWork}
                                    onChange={(e) => onUpdate({ ...room, scopeOfWork: e.target.value })}
                                />
                                <div className="absolute bottom-10 right-10 flex gap-5">
                                    <button 
                                        disabled={!room.scopeOfWork || isAnalyzing}
                                        onClick={handleAnalyzeScope}
                                        className="bg-brand-600 text-white px-10 py-5 rounded-[1.5rem] text-xs font-black shadow-2xl shadow-brand-200 hover:bg-brand-700 transition-all flex items-center gap-4 disabled:opacity-50 uppercase tracking-[0.2em]"
                                    >
                                        {isAnalyzing ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={24} strokeWidth={2.5} />}
                                        ANALYZE WITH AI
                                    </button>
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
    onImport: (e: React.ChangeEvent<HTMLInputElement>) => void,
    onResume?: () => void,
    hasActiveProject: boolean
}> = ({ onStartNew, onImport, onResume, hasActiveProject }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-10 overflow-hidden relative">
            {/* Animated Background Gradients */}
            <div className="absolute top-[-25%] left-[-20%] w-[80%] h-[80%] bg-brand-50/40 rounded-full blur-[180px] -z-10 animate-pulse-slow"></div>
            <div className="absolute bottom-[-20%] right-[-15%] w-[70%] h-[70%] bg-blue-50/40 rounded-full blur-[160px] -z-10 animate-pulse-slow delay-1500"></div>

            <div className="max-w-6xl w-full text-center space-y-24 animate-in fade-in zoom-in duration-1000">
                <div className="space-y-12">
                    <div className="inline-flex items-center gap-5 px-8 py-4 bg-slate-900 text-white rounded-full text-[11px] font-black tracking-[0.3em] uppercase shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] mb-4 scale-110">
                        <ShieldCheck size={20} className="text-brand-400" />
                        Professional Estimation Engine
                    </div>
                    <h1 className="text-8xl md:text-[10rem] font-black text-slate-900 tracking-tighter leading-[0.8] lg:px-24">
                        Master <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400">
                            Builds.
                        </span>
                    </h1>
                    <p className="text-slate-500 text-2xl md:text-3xl font-medium max-w-4xl mx-auto leading-relaxed px-8 opacity-90">
                        The ultimate estimation platform for elite interior remodelers. 
                        Precision logic, architectural intelligence, and high-fidelity reporting.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-12 px-8 max-w-5xl mx-auto">
                    {/* New Project Action */}
                    <button 
                        onClick={onStartNew}
                        className="group relative bg-white border border-slate-100 p-16 rounded-[4.5rem] text-left hover:border-brand-400/40 hover:shadow-[0_60px_100px_-20px_rgba(14,165,233,0.18)] transition-all duration-700 active:scale-[0.98]"
                    >
                        <div className="w-28 h-28 bg-brand-50 text-brand-600 rounded-[2.5rem] flex items-center justify-center mb-12 group-hover:bg-brand-600 group-hover:text-white transition-all duration-700 rotate-12 group-hover:rotate-0 shadow-2xl shadow-brand-50">
                            <Plus size={56} strokeWidth={3} />
                        </div>
                        <h3 className="text-5xl font-black text-slate-900 mb-6 tracking-tight">New Project</h3>
                        <p className="text-slate-400 text-xl font-medium leading-relaxed mb-12 pr-10">
                            Start a fresh estimate from zero using built-in trades and AI-assisted pricing.
                        </p>
                        <div className="flex items-center gap-5 font-black text-brand-600 group-hover:translate-x-8 transition-transform text-sm uppercase tracking-[0.25em]">
                            Launch Workspace <ArrowRight size={26} strokeWidth={3} />
                        </div>
                    </button>

                    {/* Import Project Action */}
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="group relative bg-white border border-slate-100 p-16 rounded-[4.5rem] text-left hover:border-slate-300 hover:shadow-[0_60px_100px_-20px_rgba(0,0,0,0.1)] transition-all duration-700 active:scale-[0.98]"
                    >
                        <div className="w-28 h-28 bg-slate-50 text-slate-700 rounded-[2.5rem] flex items-center justify-center mb-12 group-hover:bg-slate-900 group-hover:text-white transition-all duration-700 -rotate-12 group-hover:rotate-0 shadow-2xl shadow-slate-100">
                            <Upload size={52} strokeWidth={3} />
                        </div>
                        <h3 className="text-5xl font-black text-slate-900 mb-6 tracking-tight">Import Data</h3>
                        <p className="text-slate-400 text-xl font-medium leading-relaxed mb-12 pr-10">
                            Restore an existing project file from your local disk or cloud storage.
                        </p>
                        <div className="flex items-center gap-5 font-black text-slate-600 group-hover:translate-x-8 transition-transform text-sm uppercase tracking-[0.25em]">
                            Sync File <FolderOpen size={26} strokeWidth={3} />
                        </div>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={onImport} accept=".json" className="hidden" />
                </div>

                {hasActiveProject && (
                  <div className="pt-16">
                    <button 
                      onClick={onResume}
                      className="inline-flex items-center gap-6 text-slate-400 hover:text-slate-900 font-black text-[11px] uppercase tracking-[0.4em] transition-all bg-slate-50 hover:bg-slate-100 px-12 py-6 rounded-full border border-slate-200 shadow-sm"
                    >
                      <History size={22} strokeWidth={3} />
                      RESUME ACTIVE SESSION
                    </button>
                  </div>
                )}
            </div>
            
            <footer className="absolute bottom-16 text-slate-300 text-[11px] font-black tracking-[0.5em] uppercase">
                CONTRACTOR ESTIMATE PRO &copy; 2025 • MASTER SUITE
            </footer>
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

    useEffect(() => {
        const saved = localStorage.getItem('current_project');
        if (saved) {
            setProject(JSON.parse(saved));
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
            title: "Project Estimate: " + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
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
                alert("Critical Error: File format corrupted or incompatible.");
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

    if (currentView === 'landing') {
        return <LandingPage 
            onStartNew={startNewProject} 
            onImport={handleImport} 
            onResume={() => setCurrentView('editor')}
            hasActiveProject={!!project}
        />;
    }

    if (!project) return null;

    const calcItemTotal = (item: LineItem) => {
        const base = (item.quantity * item.unitPrice) + (item.quantity * (item.laborRate || 0));
        const profit = base * ((item.ecoProfit || 0) / 100);
        return base + profit + (item.markup || 0);
    };

    // Subtotal including all per-item margins
    const totalEstimateSubtotal = project.rooms.reduce((acc, r) => 
        acc + r.items.reduce((sum, i) => sum + calcItemTotal(i), 0), 0
    );

    const totalCombinedProfit = project.rooms.reduce((acc, r) => 
        acc + r.items.reduce((sum, i) => {
            const base = (i.quantity * i.unitPrice) + (i.quantity * (i.laborRate || 0));
            return sum + (base * ((i.ecoProfit || 0) / 100));
        }, 0), 0
    );

    // Global Overrides
    const contingencyValue = totalEstimateSubtotal * ((project.contingencyPct || 0) / 100);
    const taxableTotal = totalEstimateSubtotal + contingencyValue;
    const taxValue = taxableTotal * ((project.taxPct || 0) / 100);
    
    // Final Client Value
    const grossEstimateValue = taxableTotal + taxValue;
    const discountAmount = grossEstimateValue * ((project.discountPct || 0) / 100);
    const grandTotalValue = grossEstimateValue - discountAmount;

    const formatPrice = (n: number) => `$${n.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;

    return (
        <div className="min-h-screen pb-32 animate-in fade-in slide-in-from-bottom-10 duration-1000">
            <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-3xl border-b border-slate-200/50 shadow-sm">
                <div className="max-w-7xl mx-auto px-10 h-32 flex items-center justify-between">
                    <div className="flex items-center gap-10">
                        <button onClick={() => setCurrentView('landing')} className="bg-slate-900 p-5 rounded-[1.75rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] hover:scale-110 transition-all hover:bg-brand-600 group active:scale-95">
                            <PenTool className="text-brand-400 group-hover:text-white" size={36} />
                        </button>
                        <div>
                            <input 
                                className="text-4xl font-black bg-transparent border-none focus:ring-0 p-0 text-slate-900 tracking-tighter"
                                value={project.title}
                                onChange={(e) => setProject({ ...project, title: e.target.value })}
                                placeholder="Untitled Project"
                            />
                            <div className="flex items-center gap-4 text-slate-400 text-[11px] font-black uppercase tracking-[0.25em] mt-3">
                                <MapPin size={16} className="text-brand-500" />
                                {project.address.street ? (
                                    <span className="text-slate-500">{project.address.street}, {project.address.city}</span>
                                ) : (
                                    <button onClick={() => setShowSettings(true)} className="hover:text-brand-600 transition-colors border-b border-dashed border-slate-300 pb-0.5">SET SITE COORDINATES</button>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                        <button 
                            onClick={() => addRoom()}
                            className="bg-brand-600 text-white px-10 py-5 rounded-[1.5rem] flex items-center gap-4 font-black text-xs uppercase tracking-[0.2em] shadow-[0_30px_60px_-15px_rgba(14,165,233,0.3)] hover:bg-brand-700 transition-all hover:-translate-y-1 active:scale-95"
                        >
                            <Plus size={24} strokeWidth={3} /> NEW AREA
                        </button>
                        <button 
                            onClick={() => setShowPreview(true)}
                            className="px-8 py-5 text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-[1.5rem] flex items-center gap-4 font-black text-xs uppercase tracking-[0.2em] transition-all shadow-sm border border-slate-100"
                        >
                            <Eye size={26} /> PROPOSAL PREVIEW
                        </button>
                        <button onClick={() => setShowSettings(true)} className="p-5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-[1.5rem] transition-all">
                            <Settings size={30} />
                        </button>
                        <div className="h-14 w-px bg-slate-200/40 mx-3" />
                        <div className="dropdown relative group">
                            <button className="bg-slate-900 text-white px-12 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] flex items-center gap-4 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.4)] hover:bg-brand-600 transition-all active:scale-95">
                                <Download size={24} strokeWidth={2.5} />
                                EXPORT
                            </button>
                            <div className="absolute top-full right-0 mt-6 w-80 bg-white rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.25)] border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all py-6 z-50 overflow-hidden translate-y-4 group-hover:translate-y-0">
                                <button onClick={() => exportService.exportPDF(project)} className="w-full text-left px-8 py-6 text-xs font-black uppercase tracking-[0.3em] text-slate-600 hover:bg-brand-50 hover:text-brand-700 flex items-center gap-5 transition-colors">
                                    <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 shadow-sm"><FileText size={26} /></div> PDF REPORT
                                </button>
                                <button onClick={() => exportService.exportExcel(project)} className="w-full text-left px-8 py-6 text-xs font-black uppercase tracking-[0.3em] text-slate-600 hover:bg-brand-50 hover:text-brand-700 flex items-center gap-5 transition-colors">
                                    <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-600 shadow-sm"><Table size={26} /></div> EXCEL WORKBOOK
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-10 py-20 grid grid-cols-1 lg:grid-cols-12 gap-16">
                <div className="lg:col-span-8 space-y-16">
                    {/* High Level Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="bg-white p-12 rounded-[3.5rem] border border-slate-200/30 shadow-sm relative overflow-hidden group">
                            <div className="absolute -top-12 -right-12 w-48 h-48 bg-brand-50 rounded-full -z-0 opacity-40 group-hover:scale-150 transition-transform duration-1000"></div>
                            <div className="text-[11px] font-black text-slate-400 uppercase mb-4 tracking-[0.3em] relative z-10">Total Estimated Subtotal</div>
                            <div className="text-5xl font-black text-slate-900 relative z-10 tracking-tighter leading-none">{formatPrice(totalEstimateSubtotal)}</div>
                        </div>
                        <div className="bg-slate-900 p-12 rounded-[3.5rem] border border-slate-800 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.4)] relative overflow-hidden group">
                            <div className="absolute -top-12 -right-12 w-48 h-48 bg-brand-600 rounded-full -z-0 opacity-20 group-hover:scale-150 transition-transform duration-1000"></div>
                            <div className="text-[11px] font-black text-slate-500 uppercase mb-4 tracking-[0.3em] relative z-10">Consolidated Project Quote</div>
                            <div className="text-5xl font-black text-brand-400 relative z-10 tracking-tighter leading-none">{formatPrice(grandTotalValue)}</div>
                        </div>
                    </div>

                    {/* Room Cards */}
                    <div className="space-y-12">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-5xl font-black text-slate-900 tracking-tighter flex items-center gap-6">
                                <LayoutPanelLeft className="text-brand-500" size={44} strokeWidth={2.5} />
                                Area Inventory
                            </h2>
                        </div>

                        {project.rooms.map(room => (
                            <RoomCard 
                                key={room.id}
                                room={room}
                                onUpdate={updateRoom}
                                onDelete={() => deleteRoom(room.id)}
                                projectZip={project.address.zip}
                            />
                        ))}

                        <button 
                            onClick={() => addRoom()}
                            className="w-full py-32 bg-white border-4 border-dashed border-slate-100 rounded-[4.5rem] flex flex-col items-center justify-center gap-8 text-slate-300 font-black text-3xl hover:bg-brand-50/20 hover:border-brand-300 hover:text-brand-600 transition-all shadow-sm group active:scale-[0.98]"
                        >
                            <div className="w-24 h-24 rounded-[2.5rem] bg-slate-50 flex items-center justify-center group-hover:bg-brand-100 transition-all group-hover:scale-110 active:scale-90">
                                <Plus size={52} strokeWidth={3} />
                            </div>
                            DEFINE NEW WORK AREA
                        </button>
                    </div>
                </div>

                {/* Right Sidebar Financials */}
                <div className="lg:col-span-4 space-y-16">
                    <div className="bg-white rounded-[4rem] p-16 border border-slate-200/50 shadow-[0_60px_100px_-30px_rgba(0,0,0,0.1)] sticky top-48">
                        <h3 className="text-[11px] font-black mb-16 flex items-center gap-5 text-slate-400 uppercase tracking-[0.4em]">
                            <Calculator size={24} strokeWidth={2.5} />
                            FINANCIAL LOGIC
                        </h3>
                        
                        <div className="space-y-10 mb-16">
                            <div className="flex justify-between items-center group">
                                <div className="flex flex-col">
                                    <span className="text-[12px] font-black text-slate-800 uppercase tracking-[0.2em]">Contingency %</span>
                                    <span className="text-[10px] text-slate-400 font-medium">Risk buffer across total</span>
                                </div>
                                <input 
                                    type="number" className="w-28 bg-slate-50 border-none rounded-[1.25rem] p-5 text-sm text-center text-slate-900 focus:ring-4 focus:ring-brand-500/10 outline-none font-black shadow-inner transition-all"
                                    value={project.contingencyPct} onChange={(e) => setProject({...project, contingencyPct: Number(e.target.value)})}
                                />
                            </div>
                            <div className="flex justify-between items-center group">
                                <div className="flex flex-col">
                                    <span className="text-[12px] font-black text-slate-800 uppercase tracking-[0.2em]">Sales Tax %</span>
                                    <span className="text-[10px] text-slate-400 font-medium">Applied to taxable total</span>
                                </div>
                                <input 
                                    type="number" className="w-28 bg-slate-50 border-none rounded-[1.25rem] p-5 text-sm text-center text-slate-900 focus:ring-4 focus:ring-brand-500/10 outline-none font-black shadow-inner transition-all"
                                    value={project.taxPct} onChange={(e) => setProject({...project, taxPct: Number(e.target.value)})}
                                />
                            </div>
                            <div className="pt-10 border-t border-slate-100 flex justify-between items-center">
                                <div className="flex items-center gap-4 text-green-600">
                                    <TrendingUp size={24} />
                                    <span className="text-[12px] font-black uppercase tracking-[0.2em]">Total Profit Sum</span>
                                </div>
                                <span className="text-green-600 font-black text-2xl">{formatPrice(totalCombinedProfit)}</span>
                            </div>
                        </div>

                        <div className="pt-16 border-t-[6px] border-slate-900">
                            <div className="text-[11px] font-black text-slate-400 uppercase mb-6 tracking-[0.4em]">PROPOSED GRAND TOTAL</div>
                            <div className="text-7xl font-black text-slate-900 tracking-tighter leading-none">{formatPrice(grandTotalValue)}</div>
                        </div>

                        <div className="mt-20">
                            <button 
                                onClick={() => {
                                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
                                  const downloadAnchorNode = document.createElement('a');
                                  downloadAnchorNode.setAttribute("href", dataStr);
                                  downloadAnchorNode.setAttribute("download", `${project.title.replace(/\s+/g, '_')}_data.json`);
                                  document.body.appendChild(downloadAnchorNode);
                                  downloadAnchorNode.click();
                                  downloadAnchorNode.remove();
                                }}
                                className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.25em] hover:bg-brand-600 transition-all flex items-center justify-center gap-5 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] hover:-translate-y-1.5 active:scale-95"
                            >
                                <Save size={24} /> SYNC TO DRIVE (.JSON)
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Geographic Search Modal */}
            {showSettings && (
                <Modal title="Geographic Intelligence Context" onClose={() => setShowSettings(false)}>
                    <div className="space-y-12">
                        <div>
                            <label className="block text-[12px] font-black text-slate-400 mb-6 uppercase tracking-[0.3em]">Global Site Search</label>
                            <div className="flex gap-5">
                                <div className="relative flex-1">
                                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={26} strokeWidth={2.5} />
                                    <input 
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-[1.75rem] pl-20 pr-8 py-6 text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none shadow-inner transition-all"
                                        placeholder="Enter address to sync local material/labor rates..."
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleValidateAddress((e.target as HTMLInputElement).value);
                                        }}
                                    />
                                </div>
                                <button 
                                    className="bg-slate-900 text-white px-10 py-6 rounded-[1.75rem] hover:bg-brand-600 transition-all shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] hover:-translate-y-1 active:scale-95"
                                    onClick={(e) => {
                                        const input = e.currentTarget.previousElementSibling?.querySelector('input');
                                        if (input) handleValidateAddress(input.value);
                                    }}
                                    disabled={isLoading}
                                >
                                    {isLoading ? <Loader2 size={28} className="animate-spin" /> : <ArrowRight size={28} strokeWidth={3} />}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-10 bg-slate-50/50 p-10 rounded-[3rem] border border-slate-100">
                            <div className="col-span-2">
                                <label className="block text-[11px] font-black text-slate-400 mb-4 uppercase tracking-[0.2em]">Physical Street Address</label>
                                <input 
                                    className="w-full bg-white border border-slate-200 rounded-[1.25rem] px-6 py-5 text-sm font-black shadow-sm"
                                    value={project.address.street}
                                    onChange={(e) => setProject({ ...project, address: { ...project.address, street: e.target.value }})}
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-black text-slate-400 mb-4 uppercase tracking-[0.2em]">City / Locality</label>
                                <input 
                                    className="w-full bg-white border border-slate-200 rounded-[1.25rem] px-6 py-5 text-sm font-black shadow-sm"
                                    value={project.address.city}
                                    onChange={(e) => setProject({ ...project, address: { ...project.address, city: e.target.value }})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 mb-4 uppercase tracking-[0.2em]">State</label>
                                    <input 
                                        className="w-full bg-white border border-slate-200 rounded-[1.25rem] px-6 py-5 text-sm font-black shadow-sm text-center uppercase tracking-widest"
                                        value={project.address.state}
                                        onChange={(e) => setProject({ ...project, address: { ...project.address, state: e.target.value }})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 mb-4 uppercase tracking-[0.2em]">Zip Code</label>
                                    <input 
                                        className="w-full bg-white border border-slate-200 rounded-[1.25rem] px-6 py-5 text-sm font-black shadow-sm text-center tracking-widest"
                                        value={project.address.zip}
                                        onChange={(e) => setProject({ ...project, address: { ...project.address, zip: e.target.value }})}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 flex justify-end">
                            <button onClick={() => setShowSettings(false)} className="bg-slate-900 text-white px-16 py-6 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.4em] shadow-2xl hover:bg-brand-600 transition-all active:scale-95">
                                CONFIRM SITE COORDINATES
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Rendering the Proposal Modal */}
            {showPreview && (
                <Modal title="High-Fidelity Client Proposal Render" onClose={() => setShowPreview(false)} maxWidth="max-w-[1000px]">
                    <div className="bg-slate-100/50 p-16 rounded-[4rem] border border-slate-200 shadow-inner min-h-[1100px] flex flex-col font-serif overflow-hidden relative">
                        {/* Print Ready Sheet */}
                        <div className="bg-white p-20 shadow-[0_60px_100px_-30px_rgba(0,0,0,0.15)] flex-1 mx-auto w-full text-slate-800 relative z-10">
                            <div className="flex justify-between items-start border-b-[12px] border-slate-900 pb-16 mb-20">
                                <div>
                                    <h1 className="text-7xl font-black text-slate-900 tracking-tighter mb-6 uppercase leading-none">Estimate</h1>
                                    <p className="text-slate-400 text-xs font-black uppercase tracking-[0.5em] pl-1">Professional Infrastructure Services</p>
                                </div>
                                <div className="text-right space-y-3">
                                    <p className="font-bold text-2xl text-slate-900 tracking-tight">{project.title}</p>
                                    <p className="text-slate-500 text-base italic">{project.address.street}</p>
                                    <p className="text-slate-500 text-base italic">{project.address.city}, {project.address.state} {project.address.zip}</p>
                                    <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.3em] pt-6">Issued: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                </div>
                            </div>

                            <div className="space-y-24">
                                {project.rooms.map(room => (
                                    <div key={room.id} className="animate-in fade-in slide-in-from-left-6 duration-700">
                                        <div className="flex items-center gap-8 border-b-2 border-slate-100 pb-4 mb-10">
                                            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">{room.name}</h2>
                                        </div>
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                                <tr className="bg-slate-50 text-slate-400 text-[11px] font-black uppercase tracking-[0.3em] border-y border-slate-100">
                                                    <th className="py-5 px-6 w-[28%]">Work Trade</th>
                                                    <th className="py-5 px-6">Architectural Scope & Specs</th>
                                                    <th className="py-5 px-6 text-right w-[22%]">Allocated Sum</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {room.items.map(item => {
                                                    const itemTotal = calcItemTotal(item);
                                                    return (
                                                        <tr key={item.id} className="border-b border-slate-50">
                                                            <td className="py-7 px-6 font-bold text-slate-800 text-xs align-top uppercase tracking-tight">{item.category}</td>
                                                            <td className="py-7 px-6 text-slate-500 text-[13px] italic align-top leading-relaxed">{item.description}</td>
                                                            <td className="py-7 px-6 text-right font-bold text-slate-900 text-sm align-top tracking-tight">{formatPrice(itemTotal)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr className="border-t-[3px] border-slate-900 font-black">
                                                    <td colSpan={2} className="py-7 px-6 text-right text-[11px] text-slate-400 uppercase tracking-[0.4em]">{room.name} Total Allocation:</td>
                                                    <td className="py-7 px-6 text-right text-lg text-slate-900 tracking-tighter">
                                                        {formatPrice(room.items.reduce((acc, i) => acc + calcItemTotal(i), 0))}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-32 pt-16 border-t-[12px] border-slate-900 flex justify-end">
                                <div className="w-full max-w-[480px] space-y-6">
                                    <div className="flex justify-between text-slate-500 text-base font-bold border-b border-slate-100 pb-3">
                                        <span className="uppercase tracking-[0.3em] text-[11px]">Consolidated Subtotal</span>
                                        <span>{formatPrice(totalEstimateSubtotal)}</span>
                                    </div>
                                    {project.contingencyPct > 0 && (
                                        <div className="flex justify-between text-slate-400 text-sm italic">
                                            <span>Contingency Risk Reserve ({project.contingencyPct}%)</span>
                                            <span>{formatPrice(contingencyValue)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-slate-400 text-sm font-medium">
                                        <span>Estimated Jurisdictional Tax ({project.taxPct}%)</span>
                                        <span>{formatPrice(taxValue)}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-900 text-5xl font-black pt-10 border-t-[5px] border-slate-900 items-baseline">
                                        <span className="tracking-tighter">GRAND TOTAL</span>
                                        <span className="text-brand-600 tracking-tighter">{formatPrice(grandTotalValue)}</span>
                                    </div>
                                    <div className="pt-16 text-[10px] text-slate-300 italic text-right leading-loose">
                                        This document serves as a high-fidelity budgetary index. 
                                        Execution is subject to signed contractual agreements and detailed material selection. 
                                        Profit indices are proprietary and non-itemized.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default App;
