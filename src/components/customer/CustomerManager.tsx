import React, { useState, useMemo, useRef } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { formatDate } from '../../utils/format';
import { PlusIcon, TrashIcon, XMarkIcon, UsersIcon } from '../Icons';
import type { Customer } from '../../types';

const CustomerManager: React.FC = () => {
  const { customers, upsertCustomer, setCustomers } = useAppContext();
  const [search, setSearch] = useState('');
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [showImport, setShowImport] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)));
  }, [customers, search]);

  const handleDelete = (id: string) => {
    if (!confirm('Xác nhận xoá khách hàng này?')) return;
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Quản lý khách hàng</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm">
            <UsersIcon className="w-4 h-4" /> Import CSV
          </button>
          <button onClick={() => setEditCustomer({} as Customer)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm">
            <PlusIcon className="w-4 h-4" /> Thêm khách hàng
          </button>
        </div>
      </div>

      <input
        type="text"
        placeholder="Tìm theo tên hoặc SĐT..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border rounded px-3 py-2"
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800 text-left">
              <th className="border p-2">Tên khách hàng</th>
              <th className="border p-2">Số điện thoại</th>
              <th className="border p-2">Ngày tạo</th>
              <th className="border p-2 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="border p-2 text-center text-slate-500">Chưa có khách hàng.</td></tr>
            )}
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                <td className="border p-2">{c.name}</td>
                <td className="border p-2">{c.phone || '--'}</td>
                <td className="border p-2">{c.created_at ? formatDate(c.created_at) : '--'}</td>
                <td className="border p-2 text-center space-x-2">
                  <button onClick={() => setEditCustomer(c)} className="text-blue-600 hover:underline text-xs">Sửa</button>
                  <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:underline text-xs">Xoá</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editCustomer && <CustomerModal customer={editCustomer} onSave={upsertCustomer} onClose={() => setEditCustomer(null)} />}
      {showImport && <ImportCSVModal onClose={() => setShowImport(false)} />}
    </div>
  );
};

const CustomerModal: React.FC<{ customer: Customer; onSave: (c: Partial<Customer> & { id?: string }) => void; onClose: () => void }> = ({ customer, onSave, onClose }) => {
  const [name, setName] = useState(customer.name || '');
  const [phone, setPhone] = useState(customer.phone || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ id: customer.id, name: name.trim(), phone: phone.trim() });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{customer.id ? 'Sửa khách hàng' : 'Thêm khách hàng mới'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700"><XMarkIcon className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <label className="block">
            <span className="font-medium">Tên khách hàng *</span>
            <input required value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full border rounded px-3 py-2" />
          </label>
          <label className="block">
            <span className="font-medium">Số điện thoại</span>
            <input value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 w-full border rounded px-3 py-2" />
          </label>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-slate-50">Huỷ</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Lưu</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ImportCSVModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { setCustomers } = useAppContext();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Array<{ name: string; phone?: string }>>([]);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) {
        setError('File CSV trống.');
        return;
      }
      // Phát hiện header tự động: nếu dòng đầu chứa "name" hoặc "phone" (không phân biệt hoa thường) → bỏ qua
      const firstLine = lines[0].toLowerCase();
      const hasHeader = firstLine.includes('name') || firstLine.includes('phone') || firstLine.includes('tên') || firstLine.includes('sđt');
      const dataLines = hasHeader ? lines.slice(1) : lines;
      
      const parsed: Array<{ name: string; phone?: string }> = [];
      for (const line of dataLines) {
        const cols = line.split(',').map(c => c.trim());
        if (cols.length === 0 || !cols[0]) continue;
        parsed.push({ name: cols[0], phone: cols[1] || undefined });
      }
      if (parsed.length === 0) {
        setError('Không tìm thấy dữ liệu hợp lệ trong CSV.');
        return;
      }
      setPreview(parsed);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (preview.length === 0) return;
    const newCustomers = preview.map(p => ({
      id: `CUS-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: p.name,
      phone: p.phone,
      created_at: new Date().toISOString()
    }));
    setCustomers(prev => [...newCustomers, ...prev]);
    alert(`Đã import ${newCustomers.length} khách hàng.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Import khách hàng từ CSV</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700"><XMarkIcon className="w-6 h-6" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">Chọn file CSV với cột đầu tiên là <strong>tên khách hàng</strong>, cột thứ hai là <strong>số điện thoại</strong> (tùy chọn).</p>
          <p className="text-slate-600 text-xs">Dòng đầu tiên nếu chứa "name", "phone", "tên", "sđt" sẽ tự động bỏ qua (header).</p>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} className="block w-full text-sm" />
          {error && <div className="text-red-600 text-xs">{error}</div>}
          {preview.length > 0 && (
            <div className="border rounded p-3 bg-slate-50 dark:bg-slate-900 max-h-64 overflow-y-auto">
              <div className="font-semibold mb-2">Xem trước ({preview.length} khách hàng):</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-1">Tên</th>
                    <th className="p-1">SĐT</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 20).map((p, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-1">{p.name}</td>
                      <td className="p-1">{p.phone || '--'}</td>
                    </tr>
                  ))}
                  {preview.length > 20 && <tr><td colSpan={2} className="p-1 text-slate-500">... và {preview.length - 20} khách hàng nữa</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-slate-50">Huỷ</button>
            <button disabled={preview.length === 0} onClick={handleImport} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed">
              Import {preview.length > 0 && `(${preview.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerManager;
