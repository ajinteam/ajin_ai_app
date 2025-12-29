
import React, { useState, useMemo } from 'react';
import type { OrderedPart } from '../types';
import { CloseIcon } from './icons';

interface AddOrderedPartModalProps {
  onAdd: (part: Omit<OrderedPart, 'id' | 'registrationDate'>) => void;
  onClose: () => void;
  existingParts: OrderedPart[];
}

const AddOrderedPartModal: React.FC<AddOrderedPartModalProps> = ({ onAdd, onClose, existingParts }) => {
  const [formData, setFormData] = useState({
    code: '',
    drawingNumber: '',
    name: '',
    spec: '',
    unitPrice: '',
    remarks: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    // 코드와 품명(name)만 항상 대문자로 변환
    const processedValue = ['code', 'name'].includes(name) ? value.toUpperCase() : value;
    setFormData(prev => ({ ...prev, [name]: processedValue }));
  };

  // 실시간 중복 체크
  const isCodeDuplicate = useMemo(() => {
    if (!formData.code.trim()) return false;
    return existingParts.some(p => p.code?.toUpperCase() === formData.code.toUpperCase());
  }, [formData.code, existingParts]);

  const isDrawingDuplicate = useMemo(() => {
    if (!formData.drawingNumber.trim()) return false;
    return existingParts.some(p => p.drawingNumber?.toUpperCase() === formData.drawingNumber.toUpperCase());
  }, [formData.drawingNumber, existingParts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { alert('품명은 필수 입력 사항입니다.'); return; }
    
    if (isCodeDuplicate) { alert('이미 등록된 코드입니다. 다시 확인해주세요.'); return; }
    if (isDrawingDuplicate) { alert('이미 등록된 도번입니다. 다시 확인해주세요.'); return; }

    onAdd({
      code: formData.code.trim(),
      drawingNumber: formData.drawingNumber.trim(),
      name: formData.name.trim(),
      spec: formData.spec.trim(),
      unitPrice: Number(formData.unitPrice) || 0,
      remarks: formData.remarks.trim()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-up overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">신규 발주부품 등록</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-800 transition-colors"><CloseIcon className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest uppercase">코드</label>
              <input 
                type="text" 
                name="code" 
                value={formData.code} 
                onChange={handleChange} 
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono font-bold ${isCodeDuplicate ? 'border-rose-500 bg-rose-50' : 'border-slate-200'}`} 
                placeholder="코드 입력" 
              />
              {isCodeDuplicate && <p className="absolute -bottom-4 left-0 text-[9px] text-rose-500 font-bold uppercase">이미 등록된 코드</p>}
            </div>
            <div className="relative">
              <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest uppercase">도번</label>
              <input 
                type="text" 
                name="drawingNumber" 
                value={formData.drawingNumber} 
                onChange={handleChange} 
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono font-bold ${isDrawingDuplicate ? 'border-rose-500 bg-rose-50' : 'border-slate-200'}`} 
                placeholder="도번 입력" 
              />
              {isDrawingDuplicate && <p className="absolute -bottom-4 left-0 text-[9px] text-rose-500 font-bold uppercase">이미 등록된 도번</p>}
            </div>
          </div>
          <div className="pt-2">
            <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest uppercase">품명 <span className="text-rose-500">*</span></label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" placeholder="품명을 입력하세요" />
          </div>
          <div><label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest uppercase">규격</label>
            <input type="text" name="spec" value={formData.spec} onChange={handleChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium" placeholder="부품 규격" /></div>
          <div><label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest uppercase">단가</label>
            <input type="number" name="unitPrice" value={formData.unitPrice} onChange={handleChange} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-black text-indigo-600" placeholder="0" /></div>
          <div><label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest uppercase">비고</label>
            <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={2} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"></textarea></div>
          <div className="pt-2"><button type="submit" className="w-full py-3 bg-indigo-600 text-white font-black rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95 uppercase tracking-widest text-xs">발주 부품 등록 완료</button></div>
        </form>
      </div>
    </div>
  );
};

export default AddOrderedPartModal;
