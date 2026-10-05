import React, { useState } from 'react';
import { 
  X, 
  Smartphone, 
  Download, 
  CheckCircle, 
  ExternalLink, 
  Terminal, 
  Layers, 
  Sparkles, 
  ShieldCheck, 
  HelpCircle,
  Copy,
  Check,
  FolderArchive,
  Code2,
  Cpu
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AndroidAPKModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidAPKModal: React.FC<AndroidAPKModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'build' | 'install' | 'code'>('build');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://ais-dev-4lebrnbi4nddpwfhylui4o-893915589072.europe-west2.run.app';
  const pwaBuilderUrl = `https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(currentOrigin)}`;
  const gradleBuildCmd = `./gradlew assembleDebug`;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-stone-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-gradient-to-r from-emerald-800 to-teal-800 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-emerald-300">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold">Android App & APK Build Hub</h2>
                <span className="text-[10px] bg-emerald-400/20 border border-emerald-300/40 text-emerald-200 px-2 py-0.5 rounded-full font-bold uppercase">
                  Native Android Ready
                </span>
              </div>
              <p className="text-xs text-emerald-100/80">
                Package ID: <code className="font-mono bg-white/10 px-1 rounded">com.pantrypal.app</code> • Kotlin, Jetpack Compose & CameraX
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-stone-200 bg-stone-50 px-6 pt-2">
          <button
            onClick={() => setActiveTab('build')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'build'
                ? 'border-emerald-600 text-emerald-800 bg-white rounded-t-lg'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>1. Android Studio & APK</span>
          </button>

          <button
            onClick={() => setActiveTab('install')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'install'
                ? 'border-emerald-600 text-emerald-800 bg-white rounded-t-lg'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>2. Direct Device Install</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'code'
                ? 'border-emerald-600 text-emerald-800 bg-white rounded-t-lg'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>3. Kotlin & Gradle Source</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-stone-900">
          {activeTab === 'build' && (
            <div className="space-y-4">
              {/* Native Project Download */}
              <div className="p-4.5 rounded-2xl border-2 border-emerald-500 bg-emerald-50/40 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-extrabold text-xs">
                      ★
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-stone-900 flex items-center space-x-2">
                        <span>Native Android Studio Project (Ready to Compile)</span>
                      </h3>
                      <p className="text-xs text-stone-600 mt-0.5">
                        Complete Android Gradle project with Kotlin 2.0, Jetpack Compose Material 3, CameraX, and ML Kit.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-emerald-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-stone-700">
                      <Cpu className="w-4 h-4 text-emerald-600" />
                      <span className="font-semibold">Project Bundle:</span>
                      <code className="text-stone-600">pantrypal-android-project.tar.gz</code>
                    </div>
                    <a
                      href="/pantrypal-android-project.tar.gz"
                      download="pantrypal-android-project.tar.gz"
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Android Project</span>
                    </a>
                  </div>

                  <div className="pt-2 border-t border-stone-100 text-[11px] text-stone-600 space-y-1">
                    <div className="font-bold text-stone-800">To build the APK (.apk) in Android Studio:</div>
                    <ol className="list-decimal pl-4 space-y-0.5 text-stone-600">
                      <li>Extract the archive and open the <code>android/</code> directory in <strong>Android Studio Ladybug / Koala</strong>.</li>
                      <li>Allow Gradle to sync dependencies automatically.</li>
                      <li>Click <strong>Build &gt; Build Bundle(s) / APK(s) &gt; Build APK(s)</strong>.</li>
                      <li>Android Studio compiles the standalone <code>app-debug.apk</code> to <code>app/build/outputs/apk/debug/</code>.</li>
                    </ol>
                  </div>
                </div>

                {/* Gradle Command Line */}
                <div className="bg-stone-900 text-stone-200 p-3 rounded-xl font-mono text-[11px] relative">
                  <div className="text-[10px] text-stone-400 mb-1 font-sans font-semibold">Or compile directly from terminal:</div>
                  <pre className="text-emerald-400 font-bold">{gradleBuildCmd}</pre>
                  <button
                    onClick={() => copyToClipboard(gradleBuildCmd, 'gradle')}
                    className="absolute top-2 right-2 p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-xs flex items-center space-x-1"
                  >
                    {copiedCode === 'gradle' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span className="text-[10px]">{copiedCode === 'gradle' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Cloud 1-Click APK Compiler */}
              <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/70 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Instant Cloud APK Generator (PWABuilder)</h4>
                    <p className="text-[11px] text-stone-500">Compiles a signed <code>.apk</code> and Google Play <code>.aab</code> package directly in the cloud without installing Android Studio.</p>
                  </div>
                  <a
                    href={pwaBuilderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shrink-0"
                  >
                    <span>Compile APK Online</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'install' && (
            <div className="space-y-4">
              <div className="p-4.5 rounded-2xl border-2 border-emerald-500 bg-emerald-50/40 space-y-3">
                <div className="flex items-center space-x-2.5">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-extrabold text-xs">
                    📱
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">
                      Install Direct onto Android Phone
                    </h3>
                    <p className="text-xs text-stone-600 mt-0.5">
                      Installs as an official registered Android application with full hardware camera access and home screen launcher icon.
                    </p>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-emerald-200 text-xs space-y-3">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="bg-white p-1.5 rounded-lg border border-stone-200 shadow-2xs shrink-0 text-center">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(currentOrigin)}`}
                        alt="Scan with Android Camera"
                        className="w-28 h-28 rounded"
                      />
                      <span className="text-[9px] text-stone-500 font-medium block mt-0.5">Scan with Android Camera</span>
                    </div>

                    <div className="space-y-2 flex-1 w-full text-stone-700">
                      <div className="text-[11px] font-semibold text-stone-800">Direct Android Link:</div>
                      <div className="flex items-center space-x-1.5">
                        <input
                          type="text"
                          readOnly
                          value={currentOrigin}
                          className="bg-stone-50 border border-stone-200 text-stone-600 px-2.5 py-1.5 rounded-lg text-xs flex-1 font-mono select-all truncate"
                        />
                        <button
                          onClick={() => copyToClipboard(currentOrigin, 'url')}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shrink-0 flex items-center space-x-1"
                        >
                          {copiedCode === 'url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedCode === 'url' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-stone-500">
                        Open this link in Chrome or any browser on your Android phone, then tap <strong>"Install App"</strong> in Chrome's top menu.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 pt-1">
                  <button
                    onClick={async () => {
                      if (isInstallable) {
                        await install();
                      } else {
                        alert('To install on your Android device:\n1. Scan the QR code with your phone camera\n2. Open in Chrome on Android\n3. Tap "Install App" in Chrome menu');
                      }
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isInstallable ? 'Install on this Device' : 'Install on Android Phone'}</span>
                  </button>
                  <span className="text-[11px] text-stone-500">
                    Package ID: <code>com.pantrypal.app</code>
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-stone-900 mb-1">MainActivity.kt (Kotlin & Jetpack Compose)</h4>
                <p className="text-[11px] text-stone-500 mb-2">Native Android UI scaffold with Material 3 and Navigation.</p>
                <div className="bg-stone-900 text-emerald-300 p-3.5 rounded-xl font-mono text-[11px] max-h-56 overflow-y-auto">
                  <pre className="whitespace-pre-wrap">{`package com.pantrypal.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.*
import com.pantrypal.app.model.InventoryItem

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(
                primary = Color(0xFF059669),
                secondary = Color(0xFF0D9488)
            )) {
                PantryPalAndroidApp()
            }
        }
    }
}`}</pre>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-stone-900 mb-1">app/build.gradle.kts</h4>
                <div className="bg-stone-900 text-stone-300 p-3.5 rounded-xl font-mono text-[11px] max-h-48 overflow-y-auto">
                  <pre className="whitespace-pre-wrap">{`plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.pantrypal.app"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.pantrypal.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }
}`}</pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="text-xs text-stone-500 flex items-center space-x-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Native Android Project Files Built at <code>/android/</code></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
