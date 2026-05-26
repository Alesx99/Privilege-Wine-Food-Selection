import { 
  LayoutDashboard, 
  Wine, 
  Users, 
  FileText, 
  UploadCloud,
  Landmark,
  DollarSign,
  LogOut,
  Layers,
  Sun,
  Moon,
  Lightbulb
} from 'lucide-react';

export default function Sidebar({ activePage, setActivePage, onLogout, theme, onToggleTheme, isOpen, setIsOpen, userRole }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'Magazzino Vini', icon: Wine },
    { id: 'warehouses', label: 'Depositi', icon: Landmark },
    { id: 'partners', label: 'Anagrafiche', icon: Users },
    { id: 'agents', label: 'Agenti & Provvigioni', icon: DollarSign },
    { id: 'documents', label: 'Documenti', icon: FileText },
    { id: 'suggestions', label: 'Segnalazioni Prodotti', icon: Lightbulb },
    { id: 'import', label: 'Import Area', icon: UploadCloud },
    { id: 'reconciliation', label: 'Riconciliazione', icon: Landmark },
  ];


  return (
    <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
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
                  if (setIsOpen) setIsOpen(false);
                }}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </a>
            </li>
          );
        })}
        
        {/* Separatore per Gestione Classica */}
        <li style={{ borderTop: '1px solid var(--border-color)', margin: '12px 0 8px 0', listStyle: 'none' }}></li>
        
        <li className={`sidebar-item ${activePage === 'classic' ? 'active' : ''}`}>
          <a 
            href="#classic" 
            onClick={(e) => {
              e.preventDefault();
              setActivePage('classic');
              if (setIsOpen) setIsOpen(false);
            }}
            style={{ 
              borderColor: activePage === 'classic' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
              backgroundColor: activePage === 'classic' ? 'rgba(59, 130, 246, 0.08)' : 'transparent'
            }}
          >
            <Layers size={20} style={{ color: activePage === 'classic' ? '#60a5fa' : 'inherit' }} />
            <span style={{ fontWeight: 'bold' }}>Gestione Classica</span>
          </a>
        </li>
      </ul>

      {/* Logout & Theme toggle at the bottom of the sidebar */}
      <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
        <ul className="sidebar-menu" style={{ gap: '4px' }}>
          <li className="sidebar-item" style={{ marginBottom: '8px' }}>
            <a 
              href="#toggle-theme" 
              onClick={(e) => {
                e.preventDefault();
                onToggleTheme();
              }}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              <span>{theme === 'dark' ? 'Modalità Chiara' : 'Modalità Scura'}</span>
            </a>
          </li>
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
        <div style={{ padding: '12px 16px 4px 16px', textAlign: 'center', borderTop: '1px dashed rgba(255,255,255,0.03)', marginTop: '12px' }}>
          <p className="muted-text" style={{ fontSize: '0.65rem', margin: 0, fontWeight: 'bold' }}>
            © Alesx99
          </p>
          <p className="muted-text" style={{ fontSize: '0.58rem', margin: '2px 0 0 0', opacity: 0.5 }}>
            Proprietà Esclusiva
          </p>
        </div>
      </div>
    </aside>
  );
}
