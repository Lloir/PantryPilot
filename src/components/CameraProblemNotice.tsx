import React from 'react';
import { AlertCircle, ExternalLink } from 'lucide-react';
import { CameraProblem } from '../utils/camera';

interface CameraProblemNoticeProps {
  problem: CameraProblem;
  secureUrl: string | null;
  /** What the person can do instead, e.g. "upload a photo". */
  alternative: string;
}

export const CameraProblemNotice: React.FC<CameraProblemNoticeProps> = ({ problem, secureUrl, alternative }) => (
  <div role="alert" className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
    <div className="flex items-start space-x-2">
      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <div className="space-y-1.5">
        {problem === 'insecure' && (
          <>
            <p className="font-bold">Your browser blocks the camera on this address</p>
            <p>
              Browsers only allow camera access on secure (https) pages. This page is plain http, so the browser never even asks for permission.
            </p>
            {secureUrl ? (
              <>
                <p>
                  Open the secure version instead:{' '}
                  <a href={secureUrl} className="font-bold underline inline-flex items-center space-x-1">
                    <span>{secureUrl}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
                <p className="text-amber-800/80">
                  The first time, the browser warns that the certificate isn't trusted, because PantryPal made it itself. Choose <em>Advanced</em>, then <em>Continue</em>. After that the camera asks for permission as usual.
                </p>
              </>
            ) : (
              <p>Open PantryPal through an https address (or on the same computer via localhost).</p>
            )}
          </>
        )}
        {problem === 'unsupported' && <p className="font-bold">This browser can't open the camera from a web page.</p>}
        {problem === 'denied' && (
          <>
            <p className="font-bold">Camera permission was blocked</p>
            <p>Allow the camera for this site in your browser's site settings (the lock or tune icon next to the address), then try again.</p>
          </>
        )}
        {problem === 'notfound' && <p className="font-bold">No camera was found on this device.</p>}
        {problem === 'busy' && <p className="font-bold">The camera is in use by another app. Close it and try again.</p>}
        {problem === 'other' && <p className="font-bold">The camera could not be started.</p>}
        <p>You can also {alternative}.</p>
      </div>
    </div>
  </div>
);
