
import React, { useState, useMemo, useEffect } from 'react';
import type { Item, Transaction } from './types';
import AddItemModal from './components/AddItemModal';
import ItemDetailModal from './components/ItemDetailModal';
import { PlusIcon, BoxIcon, SearchIcon, TrashIcon, DownloadIcon, CloudIcon, SettingsIcon, CloseIcon, EditIcon } from './components/icons';

const STORAGE_KEY = 'inventory_system_data_v2';
const DRIVE_CONFIG_KEY = 'inventory_drive_config';
const ADMIN_PASSWORD = '0000';
const PRODUCT_ONLY_PASSWORD = '1111';

const SCOPES = 'https://www.googleapis.com/auth/drive.file';

const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const calculateStock = (item: Item): number => {
  return item.transactions.reduce((acc, t) => {
    return t.type === 'purchase' ? acc + t.quantity : acc - t.quantity;
  }, 0);
};

const App: React.FC = () => {
  const [authRole, setAuthRole] = useState<'admin' | 'product_only' | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'part' | 'product'>('part');
  
  const [items, setItems] = useState<Item[]>([]);

  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemToDelete, setItemToDelete] = useState<{id: string, type: 'inventory'} | null>(null);
  const [deletePassword, setDeletePassword] = useState('');

  const [isDriveConfigModalOpen, setIsDriveConfigModalOpen] = useState(false);
  const [driveConfig, setDriveConfig] = useState({
    clientId: '',
    folderId: '',
  });
  const [isBackupLoading, setIsBackupLoading] = useState(false);

  useEffect(() => {
    const savedItems = localStorage.getItem(STORAGE_KEY);
    if (savedItems) {
      try { setItems(JSON.parse(savedItems)); } catch (e) { console.error(e); }
    }
    const savedConfig = localStorage.getItem(DRIVE_CONFIG_KEY);
    if (savedConfig) {
      setDriveConfig(JSON.parse(savedConfig));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const stats = useMemo(() => {
    const partItems = items.filter(i => i.type === 'part');
    const productItems = items.filter(i => i.type === 'product');
    return {
      partCount: partItems.length,
      productCount: productItems.length,
      partStock: partItems.reduce((sum, i) => sum + calculateStock(i), 0),
      productStock: productItems.reduce((sum, i) => sum + calculateStock(i), 0),
    };
  }, [items]);

  const allUsedSerials = useMemo(() => {
    const serials: string[] = [];
    items.forEach(item => {
      item.transactions.forEach(t => {
        if (t.serialNumber) serials.push(t.serialNumber.toUpperCase());
      });
    });
    return Array.from(new Set(serials));
  }, [items]);

  const handleDriveBackup = async () => {
    if (!driveConfig.clientId) {
      alert('백업을 위해 먼저 설정을 통해 Google Client ID를 입력해주세요.');
      setIsDriveConfigModalOpen(true);
      return;
    }
    setIsBackupLoading(true);
    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: driveConfig.clientId,
        scope: SCOPES,
        callback: async (response: any) => {
          if (response.error) {
            setIsBackupLoading(false);
            alert('인증에 실패했습니다: ' + response.error);
            return;
          }
          (window as any).gapi.load('client', async () => {
            await (window as any).gapi.client.init({});
            await (window as any).gapi.client.load('drive', 'v3');
            const accessToken = response.access_token;
            (window as any).gapi.client.setToken({ access_token: accessToken });
            const backupData = {
              inventory: items,
              backupDate: new Date().toISOString()
            };
            const fileData = JSON.stringify(backupData);
            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const close_delim = "\r\n--" + boundary + "--";
            const metadata = {
              name: 'inventory_full_backup.json',
              mimeType: 'application/json',
              parents: driveConfig.folderId ? [driveConfig.folderId] : undefined,
            };
            const multipartRequestBody =
              delimiter +
              'Content-Type: application/json\r\n\r\n' +
              JSON.stringify(metadata) +
              delimiter +
              'Content-Type: application/json\r\n\r\n' +
              fileData +
              close_delim;
            const searchResponse = await (window as any).gapi.client.drive.files.list({
              q: "name = 'inventory_full_backup.json' and trashed = false",
              fields: 'files(id)',
            });
            const files = searchResponse.result.files;
            let uploadResponse;
            if (files && files.length > 0) {
              uploadResponse = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${files[0].id}?uploadType=multipart`, {
                method: 'PATCH',
                headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'multipart/related; boundary=' + boundary },
                body: multipartRequestBody,
              });
            } else {
              uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'multipart/related; boundary=' + boundary },
                body: multipartRequestBody,
              });
            }
            if (uploadResponse.ok) alert('모든 데이터가 구글 드라이브에 백업되었습니다.');
            else alert('백업 실패');
            setIsBackupLoading(false);
          });
        },
      });
      client.requestAccessToken();
    } catch (error) {
      console.error(error);
      setIsBackupLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginPassword === ADMIN_PASSWORD) setAuthRole('admin');
    else if (loginPassword === PRODUCT_ONLY_PASSWORD) setAuthRole('product_only');
    else alert('비밀번호가 틀렸습니다.');
    setLoginPassword('');
  };

  const handleLogout = () => {
    setAuthRole(null);
    setSearchTerm('');
  };

  const handleAddItem = (itemData: Omit<Item, 'id' | 'transactions'>, initialQuantity: number) => {
    const newItem: Item = { ...itemData, id: generateId('item'), transactions: [] };
    if (initialQuantity > 0) {
      newItem.transactions.push({
        id: generateId('t'), type: 'purchase', quantity: initialQuantity,
        date: new Date().toISOString(), remarks: '초기 수량 등록',
      });
    }
    setItems(prev => [newItem, ...prev]);
  };

  const handleDeleteItemConfirm = () => {
    const currentPass = authRole === 'admin' ? ADMIN_PASSWORD : PRODUCT_ONLY_PASSWORD;
    if (deletePassword !== currentPass) {
      alert('비밀번호가 틀렸습니다.');
      return;
    }
    if (itemToDelete) {
      setItems(prev => prev.filter(i => i.id !== itemToDelete.id));
      setItemToDelete(null);
      setDeletePassword('');
    }
  };

  const handleUpdateItem = (itemId: string, updatedData: Partial<Item>) => {
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, ...updatedData } : item));
  };

  const handleAddTransaction = (itemId: string, transaction: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = { ...transaction, id: generateId('t') };
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, transactions: [...item.transactions, newTransaction] };
      }
      return item;
    }));
  };

  const handleUpdateTransaction = (itemId: string, transactionId: string, updatedData: Partial<Transaction>) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, transactions: item.transactions.map(t => t.id === transactionId ? { ...t, ...updatedData } : t) };
      }
      return item;
    }));
  };

  const handleDeleteTransaction = (itemId: string, transactionId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, transactions: item.transactions.filter(t => t.id !== transactionId) };
      }
      return item;
    }));
  };

  const selectedItem = useMemo(() => items.find(i => i.id === selectedItemId), [items, selectedItemId]);

  const filteredInventory = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return items.filter(item => {
        const matchesTab = (activeTab === 'part' && item.type === 'part') || (activeTab === 'product' && item.type === 'product');
        if (!matchesTab) return false;
        
        const basicMatch = item.name.toLowerCase().includes(term) || item.code.toLowerCase().includes(term);
        if (basicMatch) return true;

        if (activeTab === 'product') {
            return item.transactions.some(t => t.serialNumber?.toLowerCase().includes(term));
        }
        
        return false;
    });
  }, [items, searchTerm, activeTab]);

  const exportToExcel = () => {
    let csvContent = "\ufeff";
    let fileName = "";
    const headers = activeTab === 'part' ? ['코드', '품명', '도번', '현재재고'] : ['코드', '제품명', '현재재고'];
    csvContent += headers.join(',') + '\r\n';
    const source = filteredInventory;
    source.forEach(item => {
      const row = activeTab === 'part' 
        ? [item.code, item.name, item.drawingNumber, calculateStock(item)]
        : [item.code, item.name, calculateStock(item)];
      csvContent += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\r\n';
    });
    fileName = `${activeTab === 'part' ? '부품' : '제품'}_재고_${new Date().toISOString().split('T')[0]}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
  };

  if (!authRole) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10 animate-fade-in-up border border-slate-100">
          <div className="flex flex-col items-center mb-10">
            <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg mb-6">
              <BoxIcon className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">재고 관리 로그인</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <input 
              type="password" autoFocus value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="PASSWORD"
              className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 outline-none text-center text-3xl font-black tracking-[0.5em] transition-all"
            />
            <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl shadow-xl hover:bg-indigo-700 transition-all">로그인</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6">
            <div className="flex justify-between items-center py-4">
                <div className="flex items-center space-x-3">
                    <BoxIcon className="h-7 w-7 text-indigo-600" />
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight uppercase">재고 관리 시스템</h1>
                </div>
                <div className="flex items-center space-x-4">
                  <button onClick={() => setIsDriveConfigModalOpen(true)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><SettingsIcon className="w-5 h-5" /></button>
                  <button onClick={handleLogout} className="px-3 py-1 bg-slate-100 text-slate-500 rounded-md hover:bg-slate-200 transition-colors font-bold text-xs uppercase">Logout</button>
                </div>
            </div>
            <div className="flex space-x-8 -mb-px">
                {authRole === 'admin' && (
                  <button onClick={() => setActiveTab('part')} className={`pb-3 px-1 text-sm font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'part' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                    부품 재고관리 ({stats.partCount})
                  </button>
                )}
                <button onClick={() => setActiveTab('product')} className={`pb-3 px-1 text-sm font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'product' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                  제품 재고관리 ({stats.productCount})
                </button>
            </div>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div className="relative flex-grow max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3"><SearchIcon className="text-slate-400 w-4 h-4" /></span>
              <input
                  type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                  placeholder="품명, 코드, 일련번호 검색..."
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm font-medium"
              />
          </div>
          <div className="flex gap-2">
            <button onClick={handleDriveBackup} disabled={isBackupLoading} className={`flex items-center justify-center gap-2 px-6 py-2.5 ${isBackupLoading ? 'bg-indigo-300' : 'bg-indigo-500'} text-white font-bold rounded-lg shadow hover:bg-indigo-600 transition-all text-sm`}>
                <CloudIcon className={`w-4 h-4 ${isBackupLoading ? 'animate-bounce' : ''}`} />
                <span>백업</span>
            </button>
            <button onClick={exportToExcel} className="flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-lg shadow hover:bg-emerald-700 transition-all text-sm">
                <DownloadIcon className="w-4 h-4" />
                <span>엑셀</span>
            </button>
            <button onClick={() => setShowAddItemModal(true)} className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg shadow hover:bg-indigo-700 transition-all text-sm">
                <PlusIcon className="w-5 h-5" />
                <span>신규 등록</span>
            </button>
          </div>
        </div>

        <div className="bg-white shadow-xl border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[11px] text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100 font-black">
                <tr>
                  <th className="px-6 py-4">코드</th>
                  <th className="px-6 py-4">품명</th>
                  {activeTab === 'part' && <th className="px-6 py-4">도번</th>}
                  <th className="px-6 py-4 text-right">현재 재고</th>
                  <th className="px-6 py-4 text-center">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInventory.map(item => {
                  const stock = calculateStock(item);
                  return (
                    <tr key={item.id} className="hover:bg-indigo-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-indigo-600 font-bold">{item.code}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">{item.name}</td>
                      {activeTab === 'part' && <td className="px-6 py-4 text-slate-500 font-mono text-xs">{item.drawingNumber || '-'}</td>}
                      <td className="px-6 py-4 text-right font-black"><span className={stock > 0 ? 'text-slate-900' : 'text-rose-500'}>{stock.toLocaleString()}</span></td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => setSelectedItemId(item.id)} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-md font-bold text-xs">상세</button>
                          <button onClick={() => setItemToDelete({id: item.id, type: 'inventory'})} className="p-2 text-rose-400 hover:text-rose-600"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* 모달 섹션 */}
      {isDriveConfigModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">구글 드라이브 백업 설정</h2>
              <button onClick={() => setIsDriveConfigModalOpen(false)}><CloseIcon className="w-6 h-6 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1">Client ID</label>
                  <input type="text" value={driveConfig.clientId} onChange={(e) => setDriveConfig({...driveConfig, clientId: e.target.value})} className="w-full px-4 py-2 border rounded-lg text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1">Folder ID</label>
                  <input type="text" value={driveConfig.folderId} onChange={(e) => setDriveConfig({...driveConfig, folderId: e.target.value})} className="w-full px-4 py-2 border rounded-lg text-xs" />
                </div>
                <button onClick={() => { localStorage.setItem(DRIVE_CONFIG_KEY, JSON.stringify(driveConfig)); setIsDriveConfigModalOpen(false); alert('설정이 저장되었습니다.'); }} className="w-full py-3 bg-indigo-600 text-white font-black rounded-xl">저장</button>
            </div>
          </div>
        </div>
      )}

      {itemToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-8 max-w-sm w-full">
                <h4 className="text-lg font-black mb-4 text-center uppercase tracking-tight">삭제 비밀번호 확인</h4>
                <input type="password" autoFocus value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleDeleteItemConfirm()} className="w-full px-4 py-3 border-2 border-slate-100 rounded-xl focus:border-indigo-500 outline-none mb-4 text-center text-xl font-bold tracking-widest" />
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setItemToDelete(null)} className="py-3 bg-slate-100 rounded-xl font-bold">취소</button>
                    <button onClick={handleDeleteItemConfirm} className="py-3 bg-rose-600 text-white rounded-xl font-bold">삭제</button>
                </div>
            </div>
        </div>
      )}

      {showAddItemModal && (
        <AddItemModal onAddItem={handleAddItem} onClose={() => setShowAddItemModal(false)} existingCodes={items.map(i => i.code)} defaultType={activeTab === 'product' ? 'product' : 'part'} />
      )}
      {selectedItemId && selectedItem && (
        <ItemDetailModal 
          item={selectedItem} 
          authRole={authRole as any} 
          allUsedSerials={allUsedSerials} 
          existingCodes={items.map(i => i.code)}
          onAddTransaction={handleAddTransaction} 
          onUpdateTransaction={handleUpdateTransaction} 
          onDeleteTransaction={handleDeleteTransaction} 
          onUpdateItem={handleUpdateItem} 
          onClose={() => setSelectedItemId(null)} 
        />
      )}
    </div>
  );
};

export default App;
