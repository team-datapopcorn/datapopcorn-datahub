import React, { useState } from 'react';
import {
  BarChart3,
  Database,
  User,
  Droplet,
  Utensils,
  Shirt,
  Thermometer,
  Camera,
  Activity,
  Wallet,
  ExternalLink,
  Search,
  LayoutDashboard,
  Trophy,
  Coffee
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sampleData } from './sampleData';

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
  <div
    className={`nav-item ${active ? 'active' : ''}`}
    onClick={onClick}
  >
    <Icon size={20} />
    <span>{label}</span>
  </div>
);

function App() {
  const [activeTab, setActiveTab] = useState('overview');

  const categories = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'haerapy', label: 'Haerapy Status', icon: Database, data: sampleData.haerapy_status },
    { id: 'golf', label: 'Jeju Golf', icon: Trophy, data: sampleData.jeju_golf_courses },
    { id: 'restaurants', label: 'Restaurants', icon: Coffee, data: sampleData.ulleungdo_restaurants },
  ];

  const personalData = [
    { id: 'blood', label: 'Blood Donation', icon: Droplet, data: sampleData.blood_donation },
    { id: 'diet', label: 'Diet Log', icon: Utensils, data: sampleData.diet },
    { id: 'ootd', label: 'OOTD', icon: Shirt, data: sampleData.ootd },
    { id: 'env', label: 'Environment', icon: Thermometer, data: sampleData.environment },
    { id: 'face', label: 'Face Timelapse', icon: Camera, data: sampleData.face_timelapse },
    { id: 'health', label: 'Health', icon: Activity, data: sampleData.health },
    { id: 'finance', label: 'Finance', icon: Wallet, data: sampleData.finance },
  ];

  const activeCategory = [...categories, ...personalData].find(c => c.id === activeTab);

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="logo">
          <Database className="text-primary" />
          <span>DATA POPCORN</span>
        </div>

        <div className="nav-section">
          <p className="nav-title">External Systems</p>
          {categories.map(cat => (
            <SidebarItem
              key={cat.id}
              icon={cat.icon}
              label={cat.label}
              active={activeTab === cat.id}
              onClick={() => setActiveTab(cat.id)}
            />
          ))}
        </div>

        <div className="nav-section">
          <p className="nav-title">Personal Hub</p>
          {personalData.map(cat => (
            <SidebarItem
              key={cat.id}
              icon={cat.icon}
              label={cat.label}
              active={activeTab === cat.id}
              onClick={() => setActiveTab(cat.id)}
            />
          ))}
        </div>
      </aside>

      <main className="main-content">
        <header className="header">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1>{activeCategory?.label || 'Overview'}</h1>
            <p>Managing the future of your data ecosystem.</p>
          </motion.div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' ? (
            <motion.div
              key="overview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">3</div>
                  <div className="stat-label">Active Crawlers</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">12.5k</div>
                  <div className="stat-label">Total Data Points</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">99.9%</div>
                  <div className="stat-label">System Uptime</div>
                </div>
              </div>

              <div className="data-table-container">
                <div className="table-header">
                  <h3>Recent Aggregation Activities</h3>
                  <div className="badge badge-active">Live Syncing</div>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Last Updated</th>
                      <th>Status</th>
                      <th>Records</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Haerapy API</td>
                      <td>2 mins ago</td>
                      <td><span className="badge badge-active">Success</span></td>
                      <td>42</td>
                    </tr>
                    <tr>
                      <td>Jeju Golf Portal</td>
                      <td>1 hour ago</td>
                      <td><span className="badge badge-active">Success</span></td>
                      <td>128</td>
                    </tr>
                    <tr>
                      <td>Samsung Health</td>
                      <td>30 mins ago</td>
                      <td><span className="badge badge-pending">Syncing</span></td>
                      <td>1,054</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="data-table-container"
            >
              <div className="table-header">
                <h3>{activeCategory?.label} Dataset</h3>
                <button className="nav-item glass" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
                  <ExternalLink size={14} style={{ marginRight: '0.5rem' }} />
                  Source Docs
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      {activeCategory?.data?.[0] && Object.keys(activeCategory.data[0]).map(key => (
                        <th key={key}>{key.replace(/_/g, ' ').toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeCategory?.data?.map((row, idx) => (
                      <tr key={idx}>
                        {Object.values(row).map((val, i) => (
                          <td key={i}>
                            {typeof val === 'object'
                              ? JSON.stringify(val)
                              : Array.isArray(val)
                                ? val.join(', ')
                                : val.toString()}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
