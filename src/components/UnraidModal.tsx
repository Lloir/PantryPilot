import React, { useState } from 'react';
import { 
  X, 
  Server, 
  Download, 
  Check, 
  Copy, 
  ExternalLink, 
  HardDrive, 
  ShieldCheck, 
  FolderCheck, 
  Terminal,
  Layers,
  Database
} from 'lucide-react';

interface UnraidModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UnraidModal: React.FC<UnraidModalProps> = ({ isOpen, onClose }) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'docker' | 'compose' | 'template'>('docker');

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const dockerRunCmd = `docker run -d \\
  --name=pantrypal \\
  --restart=unless-stopped \\
  -p 3000:3000 \\
  -v /mnt/user/appdata/pantrypal:/app/data \\
  -e PORT=3000 \\
  -e NODE_ENV=production \\
  -e GEMINI_API_KEY="YOUR_GEMINI_API_KEY" \\
  pantrypal:latest`;

  const dockerComposeContent = `services:
  pantrypal:
    build: .
    image: pantrypal:latest
    container_name: pantrypal
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - /mnt/user/appdata/pantrypal:/app/data
    environment:
      - PORT=3000
      - NODE_ENV=production
      - DATA_DIR=/app/data
      - GEMINI_API_KEY=\${GEMINI_API_KEY:-}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-stone-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white shadow-sm">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold">Unraid OS & Docker Hosting</h2>
                <span className="text-[10px] bg-white/25 border border-white/40 text-white px-2 py-0.5 rounded-full font-bold uppercase">
                  Persistent Storage Ready
                </span>
              </div>
              <p className="text-xs text-orange-100">
                Self-host on Unraid with automated <code>/mnt/user/appdata/pantrypal</code> data persistence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-stone-200 bg-stone-50 px-6 pt-2">
          <button
            onClick={() => setActiveTab('docker')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'docker'
                ? 'border-orange-600 text-orange-700 bg-white rounded-t-lg'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>1. Docker Run CLI</span>
          </button>

          <button
            onClick={() => setActiveTab('compose')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'compose'
                ? 'border-orange-600 text-orange-700 bg-white rounded-t-lg'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2. Docker Compose</span>
          </button>

          <button
            onClick={() => setActiveTab('template')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'template'
                ? 'border-orange-600 text-orange-700 bg-white rounded-t-lg'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>3. Unraid XML Template</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-stone-900">
          {/* Persistent Data Feature Banner */}
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 text-xs space-y-2">
            <div className="flex items-center space-x-2 text-amber-900 font-bold">
              <Database className="w-4 h-4 text-orange-600" />
              <span>Full Persistent Storage for Unraid Users</span>
            </div>
            <p className="text-stone-600 leading-relaxed">
              When you mount <code>/mnt/user/appdata/pantrypal</code> to <code>/app/data</code>, the backend automatically saves and restores all pantry items, recipes, weekly plans, and cost logs to <code>pantry-db.json</code> on your Unraid array/cache. All household phones and tablets accessing your Unraid IP share the same live pantry!
            </p>
          </div>

          {activeTab === 'docker' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700">Run in Unraid Terminal:</span>
                <button
                  onClick={() => copyToClipboard(dockerRunCmd, 'dockerrun')}
                  className="px-2.5 py-1 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-md flex items-center space-x-1"
                >
                  {copiedCode === 'dockerrun' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCode === 'dockerrun' ? 'Copied' : 'Copy Command'}</span>
                </button>
              </div>
              <div className="bg-stone-900 text-stone-200 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed">
                <pre>{dockerRunCmd}</pre>
              </div>
              <div className="text-[11px] text-stone-500 space-y-1 pl-1">
                <div>• Web UI will be available at: <code>http://[UNRAID-IP]:3000</code></div>
                <div>• Persistent data will be saved at: <code>/mnt/user/appdata/pantrypal/pantry-db.json</code></div>
              </div>
            </div>
          )}

          {activeTab === 'compose' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700">docker-compose.yml (for Unraid Compose Plugin):</span>
                <button
                  onClick={() => copyToClipboard(dockerComposeContent, 'compose')}
                  className="px-2.5 py-1 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-md flex items-center space-x-1"
                >
                  {copiedCode === 'compose' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCode === 'compose' ? 'Copied' : 'Copy Compose YAML'}</span>
                </button>
              </div>
              <div className="bg-stone-900 text-stone-200 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed">
                <pre>{dockerComposeContent}</pre>
              </div>
            </div>
          )}

          {activeTab === 'template' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-3">
                <h4 className="text-xs font-bold text-stone-900 flex items-center space-x-1.5">
                  <HardDrive className="w-4 h-4 text-orange-600" />
                  <span>Unraid Community Applications XML Template</span>
                </h4>
                <p className="text-xs text-stone-600">
                  Drop <code>my-PantryPal.xml</code> into your Unraid Flash drive user templates folder to configure with Unraid's native WebGUI.
                </p>

                <div className="pt-1 flex items-center space-x-3">
                  <a
                    href="/my-PantryPal.xml"
                    download="my-PantryPal.xml"
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download my-PantryPal.xml</span>
                  </a>
                </div>

                <div className="text-[11px] text-stone-500 font-mono bg-white p-2.5 rounded-lg border border-stone-200 mt-2">
                  Destination: /boot/config/plugins/dockerMan/templates-user/my-PantryPal.xml
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="text-xs text-stone-500 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Healthcheck: <code>/api/health</code> • Port 3000</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
