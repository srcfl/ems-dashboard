import { useState } from 'react';
import { X, Github, Heart, AlertTriangle } from 'lucide-react';

export function OpenSourceBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-purple-900/80 to-indigo-900/80 border-b border-purple-700/50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 flex-1">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5 sm:mt-0" />
            <div className="text-sm">
              <p className="text-purple-100">
                <span className="font-semibold">Community Open Source Project</span>
                <span className="hidden sm:inline"> — </span>
                <br className="sm:hidden" />
                <span className="text-purple-200">
                  This dashboard is under active development. Things might break!
                </span>
              </p>
              <p className="text-purple-300 mt-1">
                <Heart className="w-3.5 h-3.5 inline mr-1 text-pink-400" />
                We welcome contributions!{' '}
                <a
                  href="https://github.com/srcfl/ems-dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-white hover:text-yellow-300 underline underline-offset-2"
                >
                  <Github className="w-3.5 h-3.5" />
                  Open an issue, request features, or submit a PR
                </a>
              </p>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-purple-300 hover:text-white transition-colors p-1 flex-shrink-0"
            aria-label="Dismiss banner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
