'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertTriangle, Sparkles, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { ResumeDiffViewer } from '@/components/resume/ResumeDiffViewer';
import type { TailoredResume } from '@/lib/types/resume';

interface ResumeListItem {
  resumeId: string;
  fileName: string;
  isMaster: boolean;
  skillsFound: number;
  uploadedAt: string;
  contact: { name: string; email?: string };
}

export default function ResumePage() {
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [selectedResume, setSelectedResume] = useState<ResumeListItem | null>(null);
  const [tailoredResume, setTailoredResume] = useState<TailoredResume | null>(null);
  const [tailorJobId, setTailorJobId] = useState('');
  const [tailoring, setTailoring] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/resumes')
      .then(r => r.json())
      .then(d => {
        setResumes(d.resumes || []);
        if (d.resumes?.length > 0) setSelectedResume(d.resumes[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Check for tailor query param
    const params = new URLSearchParams(window.location.search);
    const jobParam = params.get('tailor');
    if (jobParam) setTailorJobId(jobParam);
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError('');
    setUploadSuccess('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/resumes', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setUploadSuccess(`Resume uploaded! Found ${data.skillsFound} skills.`);
      // Refresh list
      const refreshed = await fetch('/api/resumes').then(r => r.json());
      setResumes(refreshed.resumes || []);
      if (refreshed.resumes?.length > 0) setSelectedResume(refreshed.resumes[0]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleTailor() {
    if (!selectedResume || !tailorJobId) return;
    setTailoring(true);
    setTailoredResume(null);

    try {
      const res = await fetch(`/api/resumes/${selectedResume.resumeId}/tailor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: tailorJobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tailoring failed');

      // Poll for completion — max 30 attempts (60 s)
      let retries = 0;
      const MAX_RETRIES = 30;

      const poll = async () => {
        retries += 1;
        if (retries > MAX_RETRIES) {
          setTailoredResume(prev => prev ? { ...prev, status: 'error' } : null);
          setTailoring(false);
          return;
        }
        try {
          const pollRes = await fetch(`/api/resumes/${data.tailoredResumeId}/tailor`);
          const pollData: TailoredResume = await pollRes.json();
          if (pollData.status === 'generating') {
            setTimeout(poll, 2000);
          } else {
            setTailoredResume(pollData);
            setTailoring(false);
          }
        } catch {
          setTimeout(poll, 2000);
        }
      };

      setTailoredResume({ ...data, status: 'generating', diff: [], missingSkillsWarning: [], sourceResumeId: selectedResume.resumeId, userId: '', aiAuditId: '', generatedAt: '' });
      setTimeout(poll, 2000);
    } catch (err) {
      console.error(err);
      setTailoring(false);
    }
  }

  return (
    <div className="space-y-8 page-enter">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Resume</h1>
        <p className="text-sm text-slate-400">Upload your master resume and tailor it for specific roles.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Left panel: upload + list */}
        <div className="space-y-4">
          {/* Upload zone */}
          <div
            className={clsx(
              'rounded-2xl border-2 border-dashed p-6 text-center transition cursor-pointer',
              'border-surface-border hover:border-brand/40 hover:bg-brand/5',
              uploading && 'opacity-60 pointer-events-none',
            )}
            onClick={() => fileRef.current?.click()}
            onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload resume"
          >
            <Upload className="mx-auto h-8 w-8 text-slate-500" />
            <p className="mt-2 text-sm font-semibold text-slate-300">
              {uploading ? 'Uploading…' : 'Upload Resume'}
            </p>
            <p className="mt-1 text-xs text-slate-500">PDF, DOCX, or TXT · Max 10MB</p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="sr-only"
              onChange={handleUpload}
              aria-hidden="true"
            />
          </div>

          {uploadError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/8 px-3 py-2.5 text-xs text-red-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {uploadError}
            </div>
          )}
          {uploadSuccess && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-3 py-2.5 text-xs text-emerald-400">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {uploadSuccess}
            </div>
          )}

          {/* Resume list */}
          <div className="space-y-2">
            <p className="label">Your Resumes</p>
            {loading ? (
              <div className="space-y-2">
                {[1,2].map(i => <div key={i} className="h-16 rounded-xl skeleton" />)}
              </div>
            ) : resumes.length === 0 ? (
              <div className="rounded-xl border border-surface-border bg-surface-overlay px-4 py-6 text-center text-sm text-slate-500">
                No resumes yet. Upload above.
              </div>
            ) : (
              resumes.map(r => (
                <button
                  key={r.resumeId}
                  onClick={() => setSelectedResume(r)}
                  className={clsx(
                    'w-full rounded-xl border px-3 py-3 text-left transition',
                    selectedResume?.resumeId === r.resumeId
                      ? 'border-brand/30 bg-brand/8 ring-1 ring-brand/20'
                      : 'border-surface-border bg-surface-overlay hover:border-slate-600',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate text-sm font-semibold text-slate-200">{r.fileName}</span>
                    {r.isMaster && (
                      <span className="shrink-0 rounded-full bg-brand/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand-light">
                        Master
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {r.contact.name} · {r.skillsFound} skills parsed
                  </p>
                </button>
              ))
            )}
          </div>

          {/* Tailor panel */}
          {selectedResume && (
            <div className="rounded-2xl border border-surface-border bg-surface-overlay p-4 space-y-3">
              <p className="label">Tailor for a Job</p>
              <input
                className="input"
                placeholder="Paste Job ID (e.g., job-abc123)…"
                value={tailorJobId}
                onChange={e => setTailorJobId(e.target.value)}
                aria-label="Job ID to tailor resume for"
              />
              <Button
                variant="primary"
                fullWidth
                leftIcon={<Sparkles className="h-3.5 w-3.5" />}
                loading={tailoring}
                disabled={!tailorJobId.trim()}
                onClick={handleTailor}
              >
                Tailor Resume
              </Button>
              <p className="text-[11px] text-slate-600 text-center">
                AI will rephrase — not fabricate — your experience.
              </p>
            </div>
          )}
        </div>

        {/* Right panel: diff viewer */}
        <div className="space-y-3">
          {saveSuccess && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-3 py-2.5 text-xs text-emerald-400">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Changes accepted. Export functionality coming soon — copy the tailored text above.
            </div>
          )}
          {tailoredResume ? (
            <ResumeDiffViewer
              tailoredResume={tailoredResume}
              onSaveAccepted={() => {
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 5000);
              }}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-surface-border py-24 text-center">
              <Sparkles className="h-10 w-10 text-slate-600" />
              <p className="text-sm font-medium text-slate-400">No tailored resume yet.</p>
              <p className="text-xs text-slate-600">
                Select a resume and enter a Job ID, then click &ldquo;Tailor Resume.&rdquo;
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
