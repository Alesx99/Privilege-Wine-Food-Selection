import React from 'react';
import { 
  LayoutDashboard, 
  Wine, 
  Users, 
  FileText, 
  UploadCloud,
  LogOut
} from 'lucide-react';

export default function Sidebar({ activePage, setActivePage, onLogout }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'Magazzino Vini', icon: Wine },
    { id: 'partners', label: 'Anagrafiche', icon: Users },
    { id: 'documents', label: 'Documenti', icon: FileText },
    { id: 'import', label: 'Import Area', icon: UploadCloud },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '24px', padding: '8px' }}>
        <img 
          src={`${import.meta.env.BASE_URL}logo.jpeg`} 
          alt="Privilege Selection Logo" 
          style={{ width: '100%', maxWidth: '150px', height: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }} 
        />
        <span className="sidebar-brand" style={{ fontSize: '0.95rem', letterSpacing: '0.05em', marginTop: '6px' }}>Privilege ERP</span>
      </div>

      <ul className="sidebar-menu">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <li 
              key={item.id} 
              className={`sidebar-item ${activePage === item.id ? 'active' : ''}`}
            >
              <a 
                href={`#${item.id}`} 
                onClick={(e) => {
                  e.preventDefault();
                  setActivePage(item.id);
                }}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </a>
            </li>
          );
        })}
      </ul>

      {/* Logout button at the bottom of the sidebar */}
      <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
        <ul className="sidebar-menu">
          <li className="sidebar-item">
            <a 
              href="#logout" 
              onClick={(e) => {
                e.preventDefault();
                onLogout();
              }}
            >
              <LogOut size={20} />
              <span>Esci (Logout)</span>
            </a>
          </li>
        </ul>
      </div>
    </aside>
  );
}
