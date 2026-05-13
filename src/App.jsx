import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { Settings, History, Store, CheckCircle, Plus, Trash2, Users, AlertCircle, LogOut } from 'lucide-react';

// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyD-PbHRXhROMW6zZnJ9QuR4Iat6L2z4GCk",
  authDomain: "mpweb-fee81.firebaseapp.com",
  projectId: "mpweb-fee81",
  storageBucket: "mpweb-fee81.firebasestorage.app",
  messagingSenderId: "968268703366",
  appId: "1:968268703366:web:1de8c91fca9fb1729a1307",
  measurementId: "G-7FNJ0D2ZJE"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 改成直接使用根目錄集合，這樣符合 Firestore 的單數/雙數層級規則
const membersRef = collection(db, 'members');
const itemsRef = collection(db, 'items');
const settingsRef = doc(db, 'settings', 'global');

// --- Helper Functions ---
const calculateShares = (price, costs, participantCount) => {
  const numPrice = Number(price) || 0;
  const totalCosts = costs.reduce((sum, cost) => sum + (Number(cost.amount) || 0), 0);
  const netProfit = Math.floor((numPrice * 0.97) - totalCosts);
  const perPerson = participantCount > 0 ? Math.floor(netProfit / participantCount) : 0;
  return { netProfit, totalCosts, perPerson };
};

// --- Main App Component ---
export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null); // { id, name, role }
  const [members, setMembers] = useState([]);
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState({ discordWebhook: '' });
  const [activeTab, setActiveTab] = useState('selling');
  const [loading, setLoading] = useState(true);

  // Initialize Firebase Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth Error", error);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Check local storage for previous login
  useEffect(() => {
    const savedUser = localStorage.getItem('game_app_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('game_app_user');
      }
    }
  }, []);

  // Fetch Data
  useEffect(() => {
    if (!firebaseUser) return;

    const unsubMembers = onSnapshot(membersRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMembers(data);
    }, console.error);

    const unsubItems = onSnapshot(itemsRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by creation time descending in memory
      data.sort((a, b) => b.createdAt - a.createdAt);
      setItems(data);
    }, console.error);

    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      } else {
        setDoc(settingsRef, { discordWebhook: '' });
      }
      setLoading(false);
    }, console.error);

    return () => {
      unsubMembers();
      unsubItems();
      unsubSettings();
    };
  }, [firebaseUser]);

  const handleLogin = (user) => {
    setCurrentUser(user);
    localStorage.setItem('game_app_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('game_app_user');
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">載入中...</div>;
  }

  if (!currentUser) {
    return <LoginScreen members={members} onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans selection:bg-indigo-500/30">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        currentUser={currentUser} 
        onLogout={handleLogout} 
      />
      
      <main className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'selling' && (
          <SellingView items={items} members={members} currentUser={currentUser} settings={settings} />
        )}
        {activeTab === 'sold' && (
          <SoldView items={items} members={members} currentUser={currentUser} settings={settings} />
        )}
        {activeTab === 'history' && currentUser.role === 'admin' && (
          <HistoryView items={items} members={members} />
        )}
        {activeTab === 'settings' && currentUser.role === 'admin' && (
          <SettingsView members={members} settings={settings} />
        )}
      </main>
    </div>
  );
}

// --- Login Screen ---
function LoginScreen({ members, onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false);

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (password === '0821') {
      onLogin({ id: 'admin', name: '管理員', role: 'admin' });
    } else {
      setError('密碼錯誤');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-8">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">遊戲掉落物分配系統</h1>
        
        {!isAdminMode ? (
          <div className="space-y-6">
            <div className="text-sm text-gray-400 text-center mb-4">請選擇你的身分</div>
            <div className="grid grid-cols-2 gap-3">
              {members.map(m => (
                <button
                  key={m.id}
                  onClick={() => onLogin({ id: m.id, name: m.name, role: 'user' })}
                  className="bg-gray-800 hover:bg-indigo-600 transition-colors text-white py-3 px-4 rounded-xl flex items-center justify-center gap-2"
                >
                  <Users size={18} />
                  <span>{m.name}</span>
                </button>
              ))}
              {members.length === 0 && (
                <div className="col-span-2 text-center text-gray-500 py-4">
                  目前沒有成員，請先登入管理員新增。
                </div>
              )}
            </div>
            
            <div className="pt-6 border-t border-gray-800 text-center">
              <button 
                onClick={() => setIsAdminMode(true)}
                className="text-gray-500 hover:text-white transition-colors text-sm"
              >
                管理員登入
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">管理員密碼</label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="輸入密碼"
                autoFocus
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-colors"
            >
              登入
            </button>
            <div className="text-center mt-4">
              <button 
                type="button"
                onClick={() => setIsAdminMode(false)}
                className="text-gray-500 hover:text-white transition-colors text-sm"
              >
                返回成員登入
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// --- Navigation Bar ---
function Navbar({ activeTab, setActiveTab, currentUser, onLogout }) {
  const tabs = [
    { id: 'selling', label: '待售區', icon: Store },
    { id: 'sold', label: '已出售', icon: CheckCircle },
  ];

  if (currentUser.role === 'admin') {
    tabs.push({ id: 'history', label: '歷史查詢', icon: History });
    tabs.push({ id: 'settings', label: '管理員設定', icon: Settings });
  }

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center py-3 gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id 
                      ? 'bg-indigo-500/10 text-indigo-400' 
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
          
          <div className="flex items-center gap-4 text-sm whitespace-nowrap">
            <span className="text-gray-400">
              當前身分: <span className="text-white font-medium">{currentUser.name}</span>
            </span>
            <button 
              onClick={onLogout}
              className="text-red-400 hover:text-red-300 flex items-center gap-1 bg-red-400/10 px-3 py-1.5 rounded-lg transition-colors"
            >
              <LogOut size={16} />
              登出
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

// --- Selling View (待售區) ---
function SellingView({ items, members, currentUser, settings }) {
  const [showModal, setShowModal] = useState(false);
  const sellingItems = items.filter(i => i.status === 'selling');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">待售區</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors font-medium"
        >
          <Plus size={20} />
          新增物品
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sellingItems.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500 bg-gray-900 border border-gray-800 rounded-2xl">
            目前沒有待售物品
          </div>
        ) : (
          sellingItems.map(item => (
            <SellingItemCard 
              key={item.id} 
              item={item} 
              members={members} 
              currentUser={currentUser}
              settings={settings}
            />
          ))
        )}
      </div>

      {showModal && (
        <CreateItemModal 
          onClose={() => setShowModal(false)} 
          members={members} 
          currentUser={currentUser} 
        />
      )}
    </div>
  );
}

function SellingItemCard({ item, members, currentUser, settings }) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price);
  const [costs, setCosts] = useState(item.costs || []);
  
  const isSeller = currentUser.id === item.sellerId;
  const sellerName = members.find(m => m.id === item.sellerId)?.name || '未知賣家';
  
  // 即時計算分紅
  const { perPerson } = calculateShares(price, costs, item.participants.length);

  const handleUpdate = async (field, value) => {
    try {
      await updateDoc(doc(itemsRef, item.id), { [field]: value });
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddCost = () => {
    const newCosts = [...costs, { name: '', amount: 0 }];
    setCosts(newCosts);
    handleUpdate('costs', newCosts);
  };

  const handleUpdateCost = (index, field, value) => {
    const newCosts = [...costs];
    newCosts[index][field] = value;
    setCosts(newCosts);
  };

  const handleRemoveCost = (index) => {
    const newCosts = costs.filter((_, i) => i !== index);
    setCosts(newCosts);
    handleUpdate('costs', newCosts);
  };

  const markAsSold = async () => {
    if (!window.confirm('確定此物品已售出？')) return;
    try {
      await updateDoc(doc(itemsRef, item.id), { status: 'sold' });

      // 發送 Discord 通知 Tag 所有參與人 (排除賣家自己)
      if (settings.discordWebhook) {
        const tags = item.participants
          .filter(id => id !== item.sellerId) // 通常不需要 Tag 賣家自己上架
          .map(id => members.find(m => m.id === id)?.discordId)
          .filter(Boolean)
          .map(discordId => `<@${discordId}>`)
          .join(' ');

        const msg = `🎉 物品【${item.name}】已售出！\n請以下參與人前往系統回報上架，每人應上架金額為：**$${perPerson}**\n${tags}`;
        
        await fetch(settings.discordWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: msg })
        }).catch(console.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('確定要刪除這張卡片嗎？')) return;
    try {
      await deleteDoc(doc(itemsRef, item.id));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
      <div className="flex justify-between items-start gap-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => handleUpdate('name', name)}
          placeholder="物品名稱"
          className="bg-transparent text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1 flex-1 min-w-0"
        />
        {isSeller && (
          <button onClick={handleDelete} className="text-gray-600 hover:text-red-400 p-1">
            <Trash2 size={18} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm text-gray-400 bg-gray-950 p-3 rounded-xl border border-gray-800">
        <div>
          <span className="block mb-1 text-xs uppercase tracking-wider text-gray-500">賣家</span>
          <span className="text-gray-200">{sellerName}</span>
        </div>
        <div>
          <span className="block mb-1 text-xs uppercase tracking-wider text-gray-500">預估每人分紅</span>
          <span className="text-green-400 font-mono font-bold text-base">${perPerson}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-gray-400 font-medium whitespace-nowrap">預計售價 $</span>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => handleUpdate('price', Number(price))}
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 w-full focus:outline-none focus:border-indigo-500 font-mono"
        />
      </div>

      <div className="border-t border-gray-800 pt-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-400">參與人 ({item.participants.length})</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {members.map(m => {
            const isSelected = item.participants.includes(m.id);
            // 若不是賣家，且該成員未被選中，則不顯示
            if (!isSeller && !isSelected) return null;

            return (
              <button
                key={m.id}
                disabled={!isSeller}
                onClick={() => {
                  let newP = [...item.participants];
                  if (isSelected) newP = newP.filter(id => id !== m.id);
                  else newP.push(m.id);
                  handleUpdate('participants', newP);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  isSelected
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                    : 'bg-gray-800 border-gray-700 text-gray-500 hover:bg-gray-700 hover:text-gray-300'
                } ${!isSeller ? 'cursor-default' : 'cursor-pointer'}`}
              >
                {m.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="border-t border-gray-800 pt-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-400">額外成本列表</span>
          <button onClick={handleAddCost} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            <Plus size={14} /> 新增成本
          </button>
        </div>
        <div className="space-y-2">
          {costs.map((cost, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="名稱 (如剪刀)"
                value={cost.name}
                onChange={(e) => handleUpdateCost(idx, 'name', e.target.value)}
                onBlur={() => handleUpdate('costs', costs)}
                className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 w-1/2 focus:outline-none text-sm"
              />
              <input
                type="number"
                placeholder="金額"
                value={cost.amount}
                onChange={(e) => handleUpdateCost(idx, 'amount', Number(e.target.value))}
                onBlur={() => handleUpdate('costs', costs)}
                className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 w-1/2 focus:outline-none text-sm font-mono"
              />
              <button onClick={() => handleRemoveCost(idx)} className="text-gray-600 hover:text-red-400">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {costs.length === 0 && <div className="text-xs text-gray-600 italic">無額外成本</div>}
        </div>
      </div>

      {isSeller && (
        <div className="mt-auto pt-4">
          <button
            onClick={markAsSold}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-xl transition-colors flex justify-center items-center gap-2"
          >
            <CheckCircle size={20} />
            移至「已出售」並通知大家
          </button>
        </div>
      )}
    </div>
  );
}

// --- Create Item Modal ---
function CreateItemModal({ onClose, members, currentUser }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState(members.map(m => m.id)); // Default all
  const [costs, setCosts] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || selectedParticipants.length === 0) return alert('請填寫名稱並至少選擇一位參與人');
    
    try {
      await addDoc(itemsRef, {
        name,
        price: Number(price) || 0,
        participants: selectedParticipants,
        costs: costs.map(c => ({ name: c.name, amount: Number(c.amount) || 0 })),
        sellerId: currentUser.id,
        status: 'selling',
        createdAt: Date.now(),
        listedItems: {},
        settled: {}
      });
      onClose();
    } catch (error) {
      console.error(error);
      alert('建立失敗');
    }
  };

  const toggleParticipant = (id) => {
    if (selectedParticipants.includes(id)) {
      setSelectedParticipants(selectedParticipants.filter(p => p !== id));
    } else {
      setSelectedParticipants([...selectedParticipants, id]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
        <h3 className="text-xl font-bold text-white mb-6">新增待售物品</h3>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">物品名稱</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">參與人 (預設全選)</label>
            <div className="flex flex-wrap gap-2">
              {members.map(m => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => toggleParticipant(m.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    selectedParticipants.includes(m.id)
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">預計售價 (可後續修改)</label>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-400">額外成本 (可後續新增)</label>
              <button 
                type="button"
                onClick={() => setCosts([...costs, { name: '', amount: '' }])}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <Plus size={14} /> 新增
              </button>
            </div>
            <div className="space-y-2">
              {costs.map((cost, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="項目"
                    value={cost.name}
                    onChange={e => {
                      const newC = [...costs];
                      newC[idx].name = e.target.value;
                      setCosts(newC);
                    }}
                    className="w-1/2 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="金額"
                    value={cost.amount}
                    onChange={e => {
                      const newC = [...costs];
                      newC[idx].amount = e.target.value;
                      setCosts(newC);
                    }}
                    className="w-1/2 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"
                  />
                  <button 
                    type="button"
                    onClick={() => setCosts(costs.filter((_, i) => i !== idx))}
                    className="text-gray-500 hover:text-red-400 px-2"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-xl transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-colors"
            >
              建立
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Sold View (已出售) ---
function SoldView({ items, members, currentUser, settings }) {
  const soldItems = items.filter(i => i.status === 'sold');

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">已出售 (結算中)</h2>
      <div className="space-y-6">
        {soldItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-gray-900 border border-gray-800 rounded-2xl">
            目前沒有正在結算的物品
          </div>
        ) : (
          soldItems.map(item => (
            <SoldItemCard 
              key={item.id} 
              item={item} 
              members={members} 
              currentUser={currentUser} 
              settings={settings}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SoldItemCard({ item, members, currentUser, settings }) {
  const [listInputs, setListInputs] = useState({}); // 儲存輸入框狀態 { [participantId]: { name, price } }
  const [isNotifying, setIsNotifying] = useState(false);
  const isSeller = currentUser.id === item.sellerId;
  const seller = members.find(m => m.id === item.sellerId) || {};
  
  const { netProfit, totalCosts, perPerson } = calculateShares(item.price, item.costs || [], item.participants.length);

  // 送出文字提醒
  const handleNotify = async (participantId) => {
    const input = listInputs[participantId];
    if (!input?.name || !input?.price) return alert('請填寫上架物品名稱與價格');
    
    setIsNotifying(true);
    try {
      // 1. 儲存至 Firebase
      const newListedItems = { ...(item.listedItems || {}), [participantId]: input };
      await updateDoc(doc(itemsRef, item.id), { listedItems: newListedItems });

      // 2. 觸發 Discord Webhook
      if (settings.discordWebhook && seller.discordId) {
        const pName = members.find(m => m.id === participantId)?.name || '某人';
        const msg = `<@${seller.discordId}> 玩家 **${pName}** 已將替代物品【${input.name}】上架，價格為 **$${input.price}**，請前往遊戲內拉取！`;
        await fetch(settings.discordWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: msg })
        });
      }
      alert('已成功送出提醒並記錄！');
    } catch (error) {
      console.error(error);
      alert('發生錯誤，請稍後再試。');
    } finally {
      setIsNotifying(false);
    }
  };

  const handleToggleSettled = async (participantId) => {
    if (!isSeller) return;
    const isCurrentlySettled = !!item.settled?.[participantId];
    const newSettled = { ...(item.settled || {}) };
    newSettled[participantId] = !isCurrentlySettled; // 切換狀態
    
    await updateDoc(doc(itemsRef, item.id), { settled: newSettled });

    // 如果是變成「已結清」的狀態，就發送通知給該玩家
    if (!isCurrentlySettled && settings.discordWebhook) {
      const pMember = members.find(m => m.id === participantId);
      if (pMember?.discordId) {
        const msg = `✅ <@${pMember.discordId}> 賣家已結清你的【${item.name}】分紅！`;
        fetch(settings.discordWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: msg })
        }).catch(console.error);
      }
    }
  };

  const handleArchive = async () => {
    if (!window.confirm('確定要封存這筆紀錄嗎？')) return;
    await updateDoc(doc(itemsRef, item.id), { status: 'archived' });
  };

  const others = item.participants.filter(id => id !== item.sellerId);
  const allSettled = others.every(id => item.settled?.[id]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg">
      {/* Header Info */}
      <div className="bg-gray-800/50 p-5 border-b border-gray-800 flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">{item.name}</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
            <span>賣家：<span className="text-gray-200">{seller.name}</span></span>
            <span>售價：<span className="text-gray-200 font-mono">${item.price}</span> (扣3%後: ${Math.floor(item.price * 0.97)})</span>
            <span>額外成本：<span className="text-gray-200 font-mono">${totalCosts}</span></span>
            <span>總淨利：<span className="text-indigo-400 font-mono">${netProfit}</span></span>
          </div>
        </div>
        <div className="text-right bg-gray-950 px-4 py-2 rounded-xl border border-gray-800 whitespace-nowrap">
          <div className="text-xs text-gray-500 mb-0.5">每人應上架金額</div>
          <div className="text-xl font-bold text-green-400 font-mono">${perPerson}</div>
        </div>
      </div>

      {/* Participants List */}
      <div className="p-5">
        <h4 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">分配狀況</h4>
        <div className="space-y-3">
          {item.participants.map(pid => {
            const isSelf = pid === currentUser.id;
            const pName = members.find(m => m.id === pid)?.name || '未知';
            const isThisSeller = pid === item.sellerId;
            const hasListed = !!item.listedItems?.[pid];
            const listedData = item.listedItems?.[pid];
            const isSettled = !!item.settled?.[pid];
            
            return (
              <div key={pid} className={`flex flex-col xl:flex-row xl:items-center justify-between p-3 rounded-xl border ${isSettled ? 'bg-green-900/10 border-green-900/30' : 'bg-gray-950 border-gray-800'} gap-3`}>
                <div className="flex items-center gap-3 whitespace-nowrap">
                  <div className={`w-2.5 h-2.5 rounded-full ${isSettled ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <span className={`font-medium ${isSelf ? 'text-indigo-400' : 'text-gray-200'}`}>
                    {pName} {isThisSeller && <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full ml-2">賣家</span>}
                  </span>
                </div>

                {!isThisSeller && (
                  <div className="flex flex-wrap items-center gap-3 ml-5 xl:ml-0">
                    {/* 輸入與顯示區域 */}
                    {hasListed ? (
                      <div className="text-sm bg-gray-800/80 border border-gray-700 px-3 py-1.5 rounded-lg flex flex-wrap items-center gap-2">
                        <span className="text-gray-400">已上架:</span>
                        <span className="text-indigo-300 font-medium">{listedData.name}</span>
                        <span className="text-gray-600">|</span>
                        <span className="text-gray-400">價格:</span>
                        <span className="text-green-400 font-mono">${listedData.price}</span>
                      </div>
                    ) : (
                      isSelf && !isSettled && (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            placeholder="拉取的物品名稱"
                            value={listInputs[pid]?.name || ''}
                            onChange={(e) => setListInputs(prev => ({ ...prev, [pid]: { ...prev[pid], name: e.target.value } }))}
                            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:border-indigo-500"
                          />
                          <input
                            type="number"
                            placeholder="設定價格"
                            value={listInputs[pid]?.price || ''}
                            onChange={(e) => setListInputs(prev => ({ ...prev, [pid]: { ...prev[pid], price: e.target.value } }))}
                            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:border-indigo-500 font-mono"
                          />
                          <button
                            disabled={isNotifying}
                            onClick={() => handleNotify(pid)}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 text-white text-sm px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                          >
                            {isNotifying ? '送出中...' : '送出提醒'}
                          </button>
                        </div>
                      )
                    )}

                    {/* 賣家確認按鈕 */}
                    {isSeller && (
                      <button
                        onClick={() => handleToggleSettled(pid)}
                        className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors border whitespace-nowrap ${
                          isSettled 
                            ? 'bg-green-600 hover:bg-green-700 text-white border-green-500' 
                            : 'bg-transparent border-gray-600 text-gray-400 hover:bg-gray-800 hover:text-white'
                        }`}
                      >
                        {isSettled ? '已結清' : '標記結清'}
                      </button>
                    )}
                    
                    {!isSeller && (
                       <span className={`text-sm px-3 py-1.5 rounded-lg whitespace-nowrap ${isSettled ? 'bg-green-500/10 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                         {isSettled ? '賣家已確認' : '等待賣家確認'}
                       </span>
                    )}
                  </div>
                )}
                {isThisSeller && (
                  <div className="text-sm text-gray-500 ml-5 xl:ml-0 italic">
                    無需上架
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Archive Button */}
      {isSeller && (
        <div className="p-4 bg-gray-950 border-t border-gray-800">
          <button
            disabled={!allSettled}
            onClick={handleArchive}
            className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
              allSettled 
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/20' 
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            <History size={18} />
            {allSettled ? '封存至歷史紀錄' : '需全員結清才可封存'}
          </button>
        </div>
      )}
    </div>
  );
}

// --- History View (歷史查詢 - Admin Only) ---
function HistoryView({ items, members }) {
  const archivedItems = items.filter(i => i.status === 'archived');

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">歷史查詢 (僅管理員可見)</h2>
      
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {archivedItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            無歷史紀錄
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="bg-gray-950 text-gray-300 uppercase text-xs border-b border-gray-800">
                <tr>
                  <th className="px-6 py-4">時間</th>
                  <th className="px-6 py-4">物品名稱</th>
                  <th className="px-6 py-4">賣家</th>
                  <th className="px-6 py-4 text-right">售價</th>
                  <th className="px-6 py-4 text-right">每人分潤</th>
                  <th className="px-6 py-4 text-center">狀態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {archivedItems.map(item => {
                  const { perPerson } = calculateShares(item.price, item.costs || [], item.participants.length);
                  const sellerName = members.find(m => m.id === item.sellerId)?.name || '未知';
                  const date = new Date(item.createdAt).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                  
                  return (
                    <tr key={item.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">{date}</td>
                      <td className="px-6 py-4 font-medium text-gray-200">{item.name}</td>
                      <td className="px-6 py-4">{sellerName}</td>
                      <td className="px-6 py-4 text-right font-mono">${item.price}</td>
                      <td className="px-6 py-4 text-right font-mono text-indigo-400">${perPerson}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-400">
                          已結清
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Admin Settings View ---
function SettingsView({ members, settings }) {
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberDiscord, setNewMemberDiscord] = useState('');
  
  const [webhookUrl, setWebhookUrl] = useState(settings.discordWebhook || '');

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberName) return;
    try {
      await addDoc(membersRef, {
        name: newMemberName,
        discordId: newMemberDiscord,
        createdAt: Date.now()
      });
      setNewMemberName('');
      setNewMemberDiscord('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteMember = async (id) => {
    if (!window.confirm('確定刪除此成員？')) return;
    try {
      await deleteDoc(doc(membersRef, id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateDoc(settingsRef, {
        discordWebhook: webhookUrl
      });
      alert('設定已儲存');
    } catch (e) {
      console.error(e);
      alert('儲存失敗');
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-white">管理員設定</h2>

      {/* Global Settings */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Settings size={20} className="text-indigo-400"/> 系統參數設定
        </h3>
        
        {!settings.discordWebhook && (
          <div className="mb-6 bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="text-yellow-500 shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-yellow-200/80">
              強烈建議填寫你們公會專屬的 <strong>Discord Webhook URL</strong> 以接收成員上架物品的提醒。
            </p>
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Discord Webhook URL</label>
            <input
              type="text"
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">用於接收成員回報上架的通知。</p>
          </div>
          <button
            onClick={handleSaveSettings}
            className="bg-gray-800 hover:bg-gray-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors"
          >
            儲存設定
          </button>
        </div>
      </div>

      {/* Members Management */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Users size={20} className="text-indigo-400"/> 成員管理
        </h3>

        <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row gap-3 mb-8 bg-gray-950 p-4 rounded-xl border border-gray-800">
          <input
            type="text"
            required
            placeholder="成員名稱 (如: 小明)"
            value={newMemberName}
            onChange={e => setNewMemberName(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500 text-sm"
          />
          <input
            type="text"
            placeholder="Discord ID (數字格式，用於Tag)"
            value={newMemberDiscord}
            onChange={e => setNewMemberDiscord(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500 text-sm font-mono"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm whitespace-nowrap"
          >
            新增成員
          </button>
        </form>

        <div className="space-y-2">
          {members.length === 0 ? (
             <div className="text-center text-gray-500 py-4">目前無成員資料</div>
          ) : (
            members.map(m => (
              <div key={m.id} className="flex justify-between items-center bg-gray-800/50 border border-gray-800 rounded-xl p-3 hover:bg-gray-800 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                  <span className="font-medium text-gray-200">{m.name}</span>
                  <span className="text-xs text-gray-500 font-mono">
                    Discord ID: {m.discordId || '未設定'}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteMember(m.id)}
                  className="text-gray-500 hover:text-red-400 p-2 transition-colors"
                  title="刪除成員"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}