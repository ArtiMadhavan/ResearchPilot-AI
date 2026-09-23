import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  ArrowUpRight, BookOpen, Bookmark, Check, ChevronDown, ChevronRight,
  Clipboard, Clock3, FileText, Filter, FolderOpen, Hash, Info, Library, ListFilter,
  Menu, MessageSquare, MoreHorizontal, Network, PanelLeft, Plus, Search, Send,
  Settings, Sparkles, Star, Tags, Target, ThumbsUp, Upload, UserRound, X, Zap,
} from 'lucide-react';
import { Link, Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const localDemoMode = import.meta.env.DEV && !import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#c6a54b',
    colorForeground: '#202838',
    colorMutedForeground: '#6f756f',
    colorDanger: '#a64e45',
    colorBackground: '#fbfaf7',
    colorInput: '#f5f1e7',
    colorInputForeground: '#202838',
    colorNeutral: '#d8d2c5',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.5rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbfaf7] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-display text-[#202838]',
    headerSubtitle: 'text-[#6f756f]',
    socialButtonsBlockButtonText: 'text-[#202838]',
    formFieldLabel: 'text-[#202838]',
    footerActionLink: 'text-[#896c1c]',
    footerActionText: 'text-[#6f756f]',
    dividerText: 'text-[#6f756f]',
    identityPreviewEditButton: 'text-[#896c1c]',
    formFieldSuccessText: 'text-[#46705f]',
    alertText: 'text-[#8d463e]',
    logoBox: 'mb-5',
    logoImage: 'max-h-10',
    socialButtonsBlockButton: 'border-[#d8d2c5] bg-[#f5f1e7] hover:bg-[#eee8da]',
    formButtonPrimary: 'bg-[#202838] text-[#fbfaf7] hover:bg-[#2c374a]',
    formFieldInput: 'border-[#d8d2c5] bg-[#f5f1e7] text-[#202838] focus:border-[#b89437]',
    footerAction: 'border-t border-[#e3ddd0] pt-5',
    dividerLine: 'bg-[#e3ddd0]',
    alert: 'border-[#e5c9c2] bg-[#f8e9e4]',
    otpCodeFieldInput: 'border-[#d8d2c5] bg-[#f5f1e7] text-[#202838]',
    formFieldRow: 'mb-4',
    main: 'px-1',
  },
};

type Paper = {
  id: string; title: string; authors: string[]; year: number; venue: string; pages: string;
  status: 'Reading' | 'Unread' | 'Complete'; tags: string[]; abstract: string; readTime: string;
  citedBy: number; favorite: boolean; accent: string; collection: string; notes: string; sourceName?: string; fileUrl?: string;
  doi?: string; volume?: string; issue?: string; articleNumber?: string;
};
type Activity = { type: string; label: string; detail: string; time: string };
type ResearchGap = { title: string; confidence: number; evidence: string; tags: string[]; sources: number };
type Citation = { paperId: string; apa: string; ieee: string; mla: string };

type AppSettings = {
  researchArea: string;
  citationStyle: 'APA' | 'IEEE' | 'MLA';
  focusModeOnOpen: boolean;
  compactLibraryRows: boolean;
  showEvidenceHighlights: boolean;
  includeSourceEvidence: boolean;
  showSimilarityScores: boolean;
  defaultSearchResults: 5 | 10 | 20;
};
const SETTINGS_KEY = 'researchpilot.settings';
const SETTINGS_DEFAULTS: AppSettings = {
  researchArea: 'Artificial Intelligence & Machine Learning',
  citationStyle: 'IEEE',
  focusModeOnOpen: true,
  compactLibraryRows: false,
  showEvidenceHighlights: true,
  includeSourceEvidence: true,
  showSimilarityScores: true,
  defaultSearchResults: 5,
};
function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...SETTINGS_DEFAULTS, ...JSON.parse(raw) } : { ...SETTINGS_DEFAULTS };
  } catch { return { ...SETTINGS_DEFAULTS }; }
}
function saveSettings(s: AppSettings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

const papersSeed: Paper[] = [
  { id: 'p1', title: 'Reliable Machine Learning for Evidence-Centered Research', authors: ['Mina Okafor', 'Elias Hart'], year: 2024, venue: 'Journal of Applied AI', pages: '118–142', status: 'Reading', tags: ['AI/ML', 'reliability', 'evidence'], abstract: 'A practical framework for evaluating model claims against reproducible evidence and clearly bounded uncertainty.', readTime: '18 min', citedBy: 42, favorite: true, accent: '#c6a54b', collection: 'AI and ML', notes: '' },
  { id: 'p2', title: 'Cloud-Native Analytics for Large-Scale Research Data', authors: ['Priya Nair', 'Theo Martin'], year: 2023, venue: 'Cloud Systems Review', pages: '1–19', status: 'Unread', tags: ['cloud computing', 'big data', 'analytics'], abstract: 'An examination of elastic storage, distributed processing, and governance patterns for research data platforms.', readTime: '24 min', citedBy: 31, favorite: false, accent: '#7198a5', collection: 'Cloud and Data', notes: '' },
  { id: 'p3', title: 'Natural Language Processing for Scholarly Sensemaking', authors: ['Jon Bell', 'Sofia Chen'], year: 2024, venue: 'Computational Linguistics Forum', pages: '44–67', status: 'Complete', tags: ['NLP', 'retrieval', 'semantics'], abstract: 'How language models and semantic retrieval can help researchers connect concepts without flattening source context.', readTime: '16 min', citedBy: 57, favorite: true, accent: '#a77765', collection: 'NLP', notes: '' },
  { id: 'p4', title: 'Generative AI Assistants and the Future of Research Workflows', authors: ['Aisha Rahman', 'Lucas Meyer'], year: 2025, venue: 'Digital Scholarship Quarterly', pages: '203–229', status: 'Reading', tags: ['Gen AI', 'human-AI', 'workflows'], abstract: 'A field study of generative AI assistants, focusing on provenance, researcher agency, and verification practices.', readTime: '21 min', citedBy: 28, favorite: false, accent: '#8d7baa', collection: 'Generative AI', notes: '' },
  { id: 'p5', title: 'Big Data Governance in Federated Cloud Environments', authors: ['Noah Williams', 'Keiko Tan'], year: 2022, venue: 'Data Infrastructure Journal', pages: '77–101', status: 'Unread', tags: ['big data', 'cloud computing', 'governance'], abstract: 'A governance model for privacy, lineage, and access control across federated data and compute environments.', readTime: '27 min', citedBy: 36, favorite: false, accent: '#6d9a79', collection: 'Cloud and Data', notes: '' },
];

function paperFromUpload(file: File): Paper {
  const title = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Uploaded research paper';
  return {
    id: `upload-${Date.now()}`,
    title,
    authors: ['Uploaded by you'],
    year: new Date().getFullYear(),
    venue: 'Personal library',
    pages: 'PDF upload',
    status: 'Unread',
    tags: ['uploaded', 'PDF'],
    abstract: 'This paper was uploaded to your workspace. Open the reader to review the source and add evidence notes.',
    readTime: 'Review needed',
    citedBy: 0,
    favorite: false,
    accent: '#7e91a7',
    collection: 'My library',
    notes: '',
    sourceName: file.name,
    fileUrl: URL.createObjectURL(file),
  };
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000`;
function apiHeaders(): HeadersInit {
  const email = localStorage.getItem('researchpilot.localEmail') || `${(localStorage.getItem('researchpilot.localUser') || 'researcher').toLowerCase().replace(/[^a-z0-9]+/g, '.')}@local.researchpilot`;
  return email ? { 'X-User-Email': email } : {};
}

// --- Intelligence API helpers ---
type ApiGap = { gap_type: string; title: string; evidence: string; paper_id: string; paper_title: string; chunk_id: number; similarity_score: number };
type ApiRoadmapStep = { step: number; gap: string; problem: string; objective: string; methodology: string; metrics: string[]; phase?: string; source: { paper_id: string; paper_title: string; chunk_id: number; similarity_score: number } };
type ApiComparison = { paper_id: string; title: string; year: number | null; keywords: string[]; abstract: string; sentence_count: number };
type ApiEvidence = { paper_id: string; title: string; text: string; chunk_index: number; score: number };

async function fetchGaps(topK = 5): Promise<ApiGap[]> {
  const res = await fetch(`${API_BASE_URL}/api/intelligence/gaps?top_k=${topK}`);
  if (!res.ok) throw new Error('gaps fetch failed');
  return res.json();
}
async function fetchRoadmap(topK = 5): Promise<ApiRoadmapStep[]> {
  const res = await fetch(`${API_BASE_URL}/api/intelligence/roadmap?top_k=${topK}`);
  if (!res.ok) throw new Error('roadmap fetch failed');
  return res.json();
}
async function fetchComparison(): Promise<ApiComparison[]> {
  const res = await fetch(`${API_BASE_URL}/api/intelligence/comparison`);
  if (!res.ok) throw new Error('comparison fetch failed');
  return res.json();
}
async function fetchPaperEvidence(paperId: string, topK = 4): Promise<ApiEvidence[]> {
  const res = await fetch(`${API_BASE_URL}/api/search?q=findings+evidence+results+conclusions&top_k=${topK}&paper_id=${encodeURIComponent(paperId)}`);
  if (!res.ok) return [];
  const all: ApiEvidence[] = await res.json();
  return all.filter((e) => e.paper_id === paperId);
}

function paperFromApi(paper: { id: string; title: string; abstract: string; keywords: string[]; created_at: string; collection?: string; tags?: string[]; notes?: string; favorite?: boolean; source_metadata?: Record<string, string> }): Paper {
  const meta = paper.source_metadata ?? {};

  // --- Real paper title: prefer PDF metadata title over filename-derived title ---
  const realTitle = (meta['title'] && meta['title'].trim()) ? meta['title'].trim() : paper.title;

  // --- Authors: parse from PDF metadata author field ---
  const rawAuthor = meta['author'] ?? '';
  const authors: string[] = rawAuthor
    ? rawAuthor.split(/[,;]+/).map((a) => a.trim()).filter((a) => a.length > 0)
    : [];

  // --- Year: try to extract from subject/date fields before falling back to upload year ---
  let year = new Date(paper.created_at).getFullYear();
  const subjectText = meta['subject'] ?? '';
  const yearMatch = subjectText.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) year = parseInt(yearMatch[0], 10);
  // Also try creationDate e.g. "D:20250715..." → 2025
  if (!yearMatch) {
    const dateStr = meta['creationDate'] ?? meta['modDate'] ?? '';
    const dateMatch = dateStr.match(/D:(\d{4})/);
    if (dateMatch) year = parseInt(dateMatch[1], 10);
  }

  // --- Venue/journal: extract from subject field before the comma/volume info ---
  // subject example: "International Journal of Disaster Risk Reduction, 117 (2025) 105173. doi:..."
  let venue = '';
  if (subjectText) {
    // Take everything before the first comma or digit run that looks like volume/page
    const venueMatch = subjectText.match(/^([^,\d]+?)(?:,|\s+\d)/);
    venue = venueMatch ? venueMatch[1].trim() : subjectText.split('.')[0].trim();
  }

  // --- DOI: look in subject or a dedicated doi field ---
  let doi = meta['doi'] ?? '';
  if (!doi) {
    const doiMatch = subjectText.match(/doi[:\s]*(10\.\S+)/i);
    if (doiMatch) doi = doiMatch[1].replace(/\.$/, '');
  }

  // --- Volume / issue / pages: parse from subject if present ---
  // subject example: "..., vol. 12, no. 3, pp. 118-142, ..."
  let volume = '';
  let issue = '';
  let pages = '';
  const volMatch = subjectText.match(/vol\.?\s*(\d+)/i);
  if (volMatch) volume = volMatch[1];
  const issueMatch = subjectText.match(/no\.?\s*(\d+)/i);
  if (issueMatch) issue = issueMatch[1];
  const ppMatch = subjectText.match(/pp\.?\s*([\d–\-]+)/i);
  if (ppMatch) pages = ppMatch[1];
  // Also try article-number pattern e.g. "117 (2025) 105173"
  let articleNumber = '';
  if (!pages && !volume) {
    const articleMatch = subjectText.match(/(\d+)\s*\(\d{4}\)\s*(\d+)/);
    if (articleMatch) { volume = articleMatch[1]; articleNumber = articleMatch[2]; }
  }

  return {
    id: paper.id,
    title: realTitle,
    authors: authors.length ? authors : ['Uploaded by you'],
    year,
    venue: venue || 'Personal library',
    pages: pages || '',
    status: 'Unread',
    tags: paper.tags?.length ? paper.tags : paper.keywords.slice(0, 5),
    abstract: paper.abstract,
    readTime: 'Review needed',
    citedBy: 0,
    favorite: paper.favorite ?? false,
    accent: '#7e91a7',
    collection: paper.collection || 'My library',
    notes: paper.notes || '',
    sourceName: realTitle,
    fileUrl: `${API_BASE_URL}/api/papers/${paper.id}/file`,
    doi: doi || undefined,
    volume: volume || undefined,
    issue: issue || undefined,
    articleNumber: articleNumber || undefined,
  };
}

async function fetchBackendPapers(): Promise<Paper[]> {
  const response = await fetch(`${API_BASE_URL}/api/papers`, { headers: apiHeaders() });
  if (!response.ok) throw new Error('Unable to load papers');
  const papers = await response.json() as Array<{ id: string; title: string; abstract: string; keywords: string[]; created_at: string; collection?: string; tags?: string[]; notes?: string; favorite?: boolean; source_metadata?: Record<string, string> }>;
  return papers.map(paperFromApi);
}

async function uploadPaperToBackend(file: File): Promise<Paper> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE_URL}/api/papers`, { method: 'POST', headers: apiHeaders(), body: formData });
  if (!response.ok) throw new Error('Unable to upload paper');
  return paperFromApi(await response.json());
}

async function updatePaperInBackend(id: string, update: Partial<Pick<Paper, 'title' | 'collection' | 'tags' | 'notes' | 'favorite'>>): Promise<Paper> {
  const response = await fetch(`${API_BASE_URL}/api/papers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...apiHeaders() }, body: JSON.stringify(update) });
  if (!response.ok) throw new Error('Unable to save paper changes');
  return paperFromApi(await response.json());
}

const activities: Activity[] = [
  { type: 'read', label: 'Finished reading', detail: 'From Search to Sensemaking', time: 'Today, 9:42 AM' },
  { type: 'gap', label: 'New gap surfaced', detail: 'Longitudinal evidence is thin', time: 'Yesterday, 4:18 PM' },
  { type: 'cite', label: 'Citation copied', detail: 'The Attention Economy of Scholarly Reading', time: 'Yesterday, 2:06 PM' },
  { type: 'add', label: 'Added to library', detail: 'Citation Practices in the Age of Generative AI', time: 'Mon, 11:30 AM' },
];
const gaps: ResearchGap[] = [
  { title: 'Longitudinal evidence on attention recovery is thin', confidence: 86, evidence: '4 of 6 core studies use a single-session design. No study follows researchers across a full writing cycle.', tags: ['attention', 'longitudinal'], sources: 6 },
  { title: 'Methodological context is rarely made machine-readable', confidence: 72, evidence: 'Only 2 papers expose enough contextual detail to compare their evidence conditions directly.', tags: ['methods', 'metadata'], sources: 8 },
  { title: 'Citation verification practices remain under-described', confidence: 64, evidence: 'The library contains strong claims about trust, but little observation of how claims are checked in practice.', tags: ['AI', 'integrity'], sources: 5 },
];
const citationsSeed: Citation[] = [
  { paperId: 'p1', apa: 'Okafor, M., & Hart, E. (2024). The attention economy of scholarly reading. Journal of Digital Scholarship, 12, 118–142.', ieee: 'M. Okafor and E. Hart, “The Attention Economy of Scholarly Reading,” Journal of Digital Scholarship, vol. 12, pp. 118–142, 2024.', mla: 'Okafor, Mina, and Elias Hart. “The Attention Economy of Scholarly Reading.” Journal of Digital Scholarship, vol. 12, 2024, pp. 118–142.' },
  { paperId: 'p2', apa: 'Nair, P., & Martín, T. (2023). From search to sensemaking: A field study of research workflows. CHI Conference on Human Factors, 1–19.', ieee: 'P. Nair and T. Martín, “From Search to Sensemaking,” CHI Conference on Human Factors, pp. 1–19, 2023.', mla: 'Nair, Priya, and Theo Martín. “From Search to Sensemaking.” CHI Conference on Human Factors, 2023, pp. 1–19.' },
  { paperId: 'p3', apa: 'Bell, J., & Chen, S. (2024). Citation practices in the age of generative AI. Research Integrity Quarterly, 44–67.', ieee: 'J. Bell and S. Chen, “Citation Practices in the Age of Generative AI,” Research Integrity Quarterly, pp. 44–67, 2024.', mla: 'Bell, Jon, and Sofia Chen. “Citation Practices in the Age of Generative AI.” Research Integrity Quarterly, 2024, pp. 44–67.' },
  { paperId: 'p4', apa: 'Rahman, A., & Meyer, L. (2025). Generative AI assistants and the future of research workflows. Digital Scholarship Quarterly, 203–229.', ieee: 'A. Rahman and L. Meyer, “Generative AI Assistants and the Future of Research Workflows,” Digital Scholarship Quarterly, pp. 203–229, 2025.', mla: 'Rahman, Aisha, and Lucas Meyer. “Generative AI Assistants and the Future of Research Workflows.” Digital Scholarship Quarterly, 2025, pp. 203–229.' },
  { paperId: 'p5', apa: 'Williams, N., & Tan, K. (2022). Big data governance in federated cloud environments. Data Infrastructure Journal, 77–101.', ieee: 'N. Williams and K. Tan, “Big Data Governance in Federated Cloud Environments,” Data Infrastructure Journal, pp. 77–101, 2022.', mla: 'Williams, Noah, and Keiko Tan. “Big Data Governance in Federated Cloud Environments.” Data Infrastructure Journal, 2022, pp. 77–101.' },
];

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: Target },
  { href: '/library', label: 'Library', icon: Library, count: papersSeed.length },
  { href: '/reader', label: 'Reader', icon: BookOpen },
  { href: '/intelligence', label: 'Intelligence', icon: Sparkles, mark: 'new' },
  { href: '/citations', label: 'Citations', icon: FileText },
  { href: '/chat', label: 'Ask your library', icon: MessageSquare },
];

function cn(...classes: Array<string | false | undefined>) { return classes.filter(Boolean).join(' '); }
function Button({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false, testId }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'outline' | 'soft'; className?: string; type?: 'button' | 'submit'; disabled?: boolean; testId?: string }) {
  const styles = { primary: 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90', ghost: 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]', outline: 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--accent))]', soft: 'bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]' };
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={cn('inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-all duration-200 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50', styles[variant], className)}>{children}</button>;
}
function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'gold' | 'green' | 'coral' | 'ink' }) {
  const tones = { muted: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]', gold: 'bg-[#f4e7bd] text-[#765815]', green: 'bg-[#dcebe4] text-[#2c6450]', coral: 'bg-[#f3dfd7] text-[#894f42]', ink: 'bg-[#e1e5ed] text-[#334059]' };
  return <span className={cn('inline-flex items-center rounded px-2 py-1 text-[11px] font-semibold tracking-wide', tones[tone])}>{children}</span>;
}
function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: ReactNode; description?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4 page-in"><div><div className="mb-2 font-mono-ui text-[10px] font-medium uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">{eyebrow}</div><h1 className="font-display text-3xl leading-tight text-[hsl(var(--foreground))] md:text-[2.65rem]">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">{description}</p>}</div>{action}</div>;
}
function StatCard({ label, value, detail, icon: Icon, accent = false }: { label: string; value: string; detail: string; icon: typeof Target; accent?: boolean }) {
  return <div className={cn('rounded-lg border p-5 transition-transform duration-200 hover:-translate-y-0.5', accent ? 'border-[#d8b65f] bg-[#f6edcf]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]')}><div className="flex items-start justify-between"><span className={cn('text-xs font-semibold uppercase tracking-[.12em]', accent ? 'text-[#80651e]' : 'text-[hsl(var(--muted-foreground))]')}>{label}</span><Icon className={cn('h-4 w-4', accent ? 'text-[#9a7926]' : 'text-[hsl(var(--muted-foreground))]')} /></div><div className="mt-4 font-display text-3xl">{value}</div><div className={cn('mt-1 text-xs', accent ? 'text-[#80651e]' : 'text-[hsl(var(--muted-foreground))]')}>{detail}</div></div>;
}
function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center"><div className="mb-4 rounded-full bg-[hsl(var(--muted))] p-3"><FolderOpen className="h-5 w-5 text-[hsl(var(--muted-foreground))]" /></div><h3 className="font-display text-lg">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]">{detail}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

function Shell({ children, papers, selectedId, setSelectedId, displayName, onSignOut }: { children: ReactNode; papers: Paper[]; selectedId: string; setSelectedId: (id: string) => void; displayName: string; onSignOut: () => void }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [globalResults, setGlobalResults] = useState<ApiEvidence[]>([]);
  const [globalSearching, setGlobalSearching] = useState(false);
  const [globalError, setGlobalError] = useState(false);
  const runGlobalSearch = async () => {
    const query = globalQuery.trim();
    if (!query) return;
    setGlobalSearching(true);
    setGlobalError(false);
    try {
      const response = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}&top_k=6`);
      if (!response.ok) throw new Error('search failed');
      setGlobalResults(await response.json() as ApiEvidence[]);
    } catch {
      setGlobalResults([]);
      setGlobalError(true);
    } finally {
      setGlobalSearching(false);
    }
  };
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/healthz`, { method: 'GET' });
        if (!cancelled) setBackendOnline(response.ok);
      } catch {
        if (!cancelled) setBackendOnline(false);
      }
    };
    void check();
    const timer = window.setInterval(check, 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);
  const initials = displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const selected = papers.find((p) => p.id === selectedId) ?? papers[0];
  const dynamicNavItems = navItems.map((item) => item.href === '/library' ? { ...item, count: papers.length } : item);
   return <div className="paper-grain min-h-[100dvh] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
    <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] px-4 py-5 transition-transform duration-300 md:translate-x-0', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
      <div className="flex items-center gap-3 px-3"><div className="grid h-9 w-9 place-items-center rounded-md bg-[#e2bf5a] text-[#202838]"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="14" width="14" height="3" rx="1"/><rect x="5" y="10" width="14" height="3" rx="1"/><rect x="7" y="6" width="14" height="3" rx="1"/><path d="M19 3c0 0 1 1 1 3s-1 3-1 3" strokeWidth="1.5"/><path d="M21 4.5 L23 2" strokeWidth="1.5"/></svg></div><div><div className="font-display text-lg tracking-tight text-[hsl(var(--sidebar-foreground))]">ResearchPilot</div><div className="font-mono-ui text-[9px] uppercase tracking-[.16em] text-[#9ba6b7]">Launch your research further.</div></div></div>
      <div className="mt-9 px-3 font-mono-ui text-[9px] uppercase tracking-[.18em] text-[#7f8999]">Workspace</div>
      <div className="mx-3 mb-2 flex items-center gap-2 rounded-md border px-3 py-2 text-[10px] font-semibold" style={{ borderColor: backendOnline === false ? '#e5c9c2' : 'transparent', background: backendOnline === false ? '#f8e9e4' : 'transparent', color: backendOnline === false ? '#894f42' : '#7f8999' }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: backendOnline === false ? '#a64e45' : '#5a9a7b' }} />{backendOnline === false ? 'Backend offline — data may be stale' : backendOnline === true ? 'Backend connected' : 'Checking backend…'}</div>
      <nav className="mt-2 space-y-1" aria-label="Primary navigation">{dynamicNavItems.map(({ href, label, icon: Icon, count, mark }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={cn('group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors', location === href ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))]' : 'text-[#aab2bf] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]')}><Icon className={cn('h-4 w-4', location === href ? 'text-[#e3c15e]' : 'text-[#7f8999] group-hover:text-[#d4b85d]')} /><span className="flex-1">{label}</span>{count !== undefined && <span className="font-mono-ui text-[10px] text-[#7f8999]">{count}</span>}{mark && <span className="rounded bg-[#d9b653] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#252d3c]">{mark}</span>}</Link>)}</nav>
      <div className="mt-8 px-3 font-mono-ui text-[9px] uppercase tracking-[.18em] text-[#7f8999]">Workspace</div>
      <nav className="mt-2 space-y-1"><Link href="/settings" onClick={() => setMobileOpen(false)} data-testid="link-nav-settings" className={cn('flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-[#aab2bf] transition-colors hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]', location === '/settings' && 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))]')}><Settings className="h-4 w-4 text-[#7f8999]" />Settings</Link></nav>
      <button type="button" onClick={() => setLocation('/settings')} className="mt-auto rounded-lg border border-[#343e4d] bg-[#202a38] p-3 text-left transition-colors hover:border-[#5f6b7a]"><div className="flex items-center gap-2"><div className="grid h-7 w-7 place-items-center rounded-full bg-[#cfaf55] text-xs font-bold text-[#222a36]">{initials}</div><div className="min-w-0"><div className="truncate text-xs font-semibold text-[#e3e7ee]">{displayName}</div><div className="truncate text-[10px] text-[#8995a6]">Profile & settings</div></div><ChevronDown className="ml-auto h-3.5 w-3.5 rotate-180 text-[#8995a6]" /></div></button>
    </aside>
    {mobileOpen && <button aria-label="Close navigation" data-testid="button-close-navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-[#18202c]/50 md:hidden" />}
    <div className="md:pl-[250px]"><header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 px-5 backdrop-blur md:px-9"><div className="flex items-center gap-3"><button onClick={() => setMobileOpen(true)} data-testid="button-open-navigation" className="rounded p-1 text-[hsl(var(--muted-foreground))] md:hidden"><Menu className="h-5 w-5" /></button><div className="relative w-[min(320px,52vw)]" data-testid="global-search"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" /><input value={globalQuery} onChange={(event) => setGlobalQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') runGlobalSearch(); }} data-testid="input-global-search" placeholder="Search your library…" className="h-9 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-9 pr-8 text-xs outline-none transition-colors placeholder:text-[hsl(var(--muted-foreground))] focus:border-[#c5a64f]" />{globalSearching && <span className="absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin rounded-full border-2 border-[#c5a64f] border-t-transparent" />}{!globalSearching && globalQuery && <button onClick={() => { setGlobalQuery(''); setGlobalResults([]); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="button-clear-global-search"><X className="h-3.5 w-3.5" /></button>}{globalResults.length > 0 && <div className="absolute right-0 top-11 z-50 w-[420px] max-w-[90vw] overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Semantic matches<button onClick={() => setGlobalResults([])} data-testid="button-close-global-results"><X className="h-3.5 w-3.5" /></button></div><div className="max-h-[380px] overflow-y-auto">{globalResults.map((result) => <button key={`${result.paper_id}-${result.chunk_index}`} onClick={() => { setSelectedId?.(result.paper_id); setGlobalResults([]); setGlobalQuery(''); setLocation('/reader'); }} className="block w-full border-b border-[hsl(var(--border))] px-3 py-2.5 text-left last:border-0 hover:bg-[hsl(var(--muted))]/50"><span className="flex items-center justify-between text-[11px] font-semibold"><span className="truncate pr-2">{result.title}</span><span className="ml-auto shrink-0 font-mono-ui text-[10px] text-[#99761f]">{Math.round(result.score * 100)}%</span></span><span className="mt-1 block line-clamp-2 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">{result.text}</span></button>)}</div></div>}{globalError && <div className="absolute right-0 top-11 z-50 w-[320px] rounded-lg border border-[#e5c9c2] bg-[#f8e9e4] px-3 py-2 text-[11px] text-[#894f42] shadow-xl">Semantic search is unavailable — check the backend server.</div>}</div></div><div className="flex items-center gap-2"><div className="h-5 w-px bg-[hsl(var(--border))]" /><button onClick={() => setLocation('/settings')} data-testid="button-user-menu" className="flex items-center gap-2 rounded-md p-1.5 hover:bg-[hsl(var(--muted))]" title="Profile & settings"><div className="grid h-7 w-7 place-items-center rounded-full bg-[#d9b653] text-[10px] font-bold text-[#263042]">{initials}</div><span className="hidden text-xs font-semibold md:block">{displayName}</span></button></div></header><main className="mx-auto max-w-[1400px] px-5 py-8 md:px-9 lg:px-12">{children}</main></div>
  </div>;
}

function Dashboard({ papers, onSelect, toggleFavorite }: { papers: Paper[]; onSelect: (id: string) => void; toggleFavorite: (id: string) => void }) {
  const reading = papers.filter((p) => p.status === 'Reading');
  const hasPapers = papers.length > 0;
  return <div className="page-in"><PageTitle eyebrow="Your research workspace" title={<>A clear view of<br /><span className="text-[#9a7822]">what matters next.</span></>} description={hasPapers ? "Your Launch your research further., distilled. Keep the thread moving." : "Your workspace is ready. Add your first paper to begin building an evidence base."} action={hasPapers ? <Button onClick={() => onSelect(reading[0]?.id ?? papers[0].id)} testId="button-resume-reading"><BookOpen className="h-4 w-4" />Resume reading</Button> : <Link href="/library" className="inline-flex h-9 items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-3 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:opacity-90" data-testid="link-add-first-paper"><Upload className="h-4 w-4" />Add your first paper</Link>} />
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 rise-in delay-1"><StatCard label="In your library" value={`${papers.length}`} detail={hasPapers ? "+2 this month" : "Nothing added yet"} icon={Library} /><StatCard label="Read this month" value={hasPapers ? "7" : "0"} detail={hasPapers ? "1h 42m of focus" : "Start with a paper"} icon={BookOpen} accent /><StatCard label="Evidence threads" value={hasPapers ? "14" : "0"} detail={hasPapers ? "3 need attention" : "Built from your library"} icon={Network} /><StatCard label="Saved citations" value={hasPapers ? "28" : "0"} detail={hasPapers ? "Across 4 projects" : "Ready when you are"} icon={FileText} /></div>
    {!hasPapers ? <div className="mt-8"><EmptyState title="Your research story starts here" detail="Upload a PDF to extract its metadata, capture evidence, and start connecting ideas across your library." action={<Link href="/library" className="inline-flex h-9 items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm font-semibold hover:border-[#c5a64f]" data-testid="link-open-library"><Library className="h-4 w-4" />Open library</Link>} /></div> : <><div className="mt-8 grid gap-5"><section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] rise-in delay-2"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4"><div><h2 className="font-display text-lg">Continue your thread</h2><p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">Where you left off</p></div><Link href="/reader" className="text-xs font-semibold text-[#92701d] hover:underline" data-testid="link-view-reader">Open reader <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></Link></div>{reading.slice(0, 2).map((paper) => <button key={paper.id} onClick={() => onSelect(paper.id)} data-testid={`card-reading-${paper.id}`} className="group flex w-full items-start gap-4 border-b border-[hsl(var(--border))] px-5 py-5 text-left last:border-0 hover:bg-[hsl(var(--muted))]/50"><div className="mt-0.5 h-11 w-1 rounded-full" style={{ background: paper.accent }} /><div className="min-w-0 flex-1"><div className="mb-1 flex items-center gap-2"><Badge tone="gold">{paper.status}</Badge><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{paper.year}</span></div><h3 className="font-display text-base leading-6 group-hover:text-[#8b6a19]">{paper.title}</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{paper.authors.join(' · ')} · {paper.venue}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full w-[64%] rounded-full bg-[#c9a94f]" /></div><div className="mt-1 flex justify-between text-[10px] text-[hsl(var(--muted-foreground))]"><span>64% through</span><span>{paper.readTime} left</span></div></div><ChevronRight className="mt-5 h-4 w-4 text-[hsl(var(--muted-foreground))] transition-transform group-hover:translate-x-1" /></button>)}</section></div><section className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]"><div className="rounded-lg border border-[#d8b65f] bg-[#f6edcf] p-5"><div className="flex items-center gap-2 text-[#80651e]"><Sparkles className="h-4 w-4" /><span className="font-mono-ui text-[10px] font-medium uppercase tracking-[.15em]">Intelligence note</span></div><h2 className="mt-4 max-w-lg font-display text-xl leading-7 text-[#283344]">The strongest gap in your library is hiding between attention and method.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-[#756339]">Six studies mention deep reading. Only two measure what happens after the session ends.</p><Link href="/intelligence" data-testid="link-explore-gap" className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-[#765815] hover:underline">Explore the connection <ArrowUpRight className="h-3.5 w-3.5" /></Link></div><div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><div className="flex items-center justify-between"><div><h2 className="font-display text-lg">Most cited in your library</h2><p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">Signals, not rankings</p></div><MoreHorizontal className="h-4 w-4" /></div>{[...papers].sort((a, b) => b.citedBy - a.citedBy).slice(0, 3).map((paper, i) => <button key={paper.id} onClick={() => onSelect(paper.id)} data-testid={`button-cited-${paper.id}`} className="mt-4 flex w-full items-center gap-3 text-left"><span className="font-mono-ui text-xs text-[#9a7822]">0{i + 1}</span><span className="flex-1 truncate text-sm font-semibold">{paper.title}</span><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{paper.citedBy} cites</span></button>)}</div></section></>}
  </div>;
}

let activeImportHandler: ((file: File) => void) | undefined;

function LibraryPage({ papers, onSelect, toggleFavorite, onImport, compact }: { papers: Paper[]; onSelect: (id: string) => void; toggleFavorite: (id: string) => void; onImport?: (file: File) => void; compact?: boolean }) {
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('All papers'); const [sort, setSort] = useState('Recent'); const fileInput = useRef<HTMLInputElement>(null);
  const importPaper = onImport ?? activeImportHandler ?? (() => {});
  const filtered = useMemo(() => papers.filter((p) => `${p.title} ${p.authors.join(' ')} ${p.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())).filter((p) => filter === 'All papers' || (filter === 'Favorites' ? p.favorite : p.status === filter)).sort((a, b) => sort === 'Most cited' ? b.citedBy - a.citedBy : b.year - a.year), [papers, query, filter, sort]);
    return <div className="page-in"><PageTitle eyebrow="Evidence library" title="Your library, in context." description={`${papers.length} papers across 9 evidence threads. Search by idea, author, or tag.`} action={<><input ref={fileInput} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) importPaper(file); event.target.value = ''; }} /><Button variant="outline" onClick={() => fileInput.current?.click()} testId="button-import-paper"><Upload className="h-4 w-4" />Import paper</Button></>} />
    <div className="mb-5 flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" /><input value={query} onChange={(e) => setQuery(e.target.value)} data-testid="input-library-search" placeholder="Search titles, authors, tags..." className="h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-[hsl(var(--muted-foreground))] focus:border-[#bd9d43]" />{query && <button onClick={() => setQuery('')} data-testid="button-clear-search" className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"><X className="h-4 w-4" /></button>}</div><div className="flex gap-2"><div className="relative"><Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" /><select value={filter} onChange={(e) => setFilter(e.target.value)} data-testid="select-library-filter" className="h-10 appearance-none rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-9 pr-8 text-xs font-semibold outline-none"><option>All papers</option><option>Favorites</option><option>Reading</option><option>Unread</option><option>Complete</option></select></div><select value={sort} onChange={(e) => setSort(e.target.value)} data-testid="select-library-sort" className="h-10 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-xs font-semibold outline-none"><option>Recent</option><option>Most cited</option></select></div></div>
    <div className="mb-4 flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]"><span>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span><button onClick={() => setFilter('All papers')} data-testid="button-library-view-options" className="inline-flex items-center gap-1 hover:text-[hsl(var(--foreground))]"><ListFilter className="h-3.5 w-3.5" />All filters</button></div>
    {filtered.length === 0 ? <EmptyState title="No evidence found" detail="Try a different search term or clear your filters. Your next useful connection may be hiding behind a synonym." action={<Button onClick={() => { setQuery(''); setFilter('All papers'); }} testId="button-reset-library">Reset view</Button>} /> : <div className="overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">{filtered.map((paper) => <div key={paper.id} className={cn('group flex gap-4 border-b border-[hsl(var(--border))] transition-colors last:border-0 hover:bg-[hsl(var(--muted))]/45', compact ? 'p-2' : 'p-4')}><div className="mt-1 h-12 w-1 shrink-0 rounded-full" style={{ background: paper.accent }} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge tone={paper.status === 'Complete' ? 'green' : paper.status === 'Reading' ? 'gold' : 'muted'}>{paper.status}</Badge><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{paper.year} · {paper.venue}</span></div><button onClick={() => onSelect(paper.id)} data-testid={`button-open-paper-${paper.id}`} className="mt-1 text-left font-display text-base leading-6 hover:text-[#876817]">{paper.title}</button><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{paper.authors.join(' · ')} <span className="mx-1">·</span> {paper.pages}</p><div className="mt-3 flex flex-wrap items-center gap-2">{paper.tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]"><Hash className="h-3 w-3 text-[#ae8c30]" />{tag}</span>)}</div></div><div className="flex shrink-0 items-start gap-2"><button onClick={() => toggleFavorite(paper.id)} aria-label={paper.favorite ? `Remove ${paper.title} from favorites` : `Favorite ${paper.title}`} data-testid={`button-favorite-${paper.id}`} className={cn('rounded p-1.5 transition-colors', paper.favorite ? 'text-[#ad8a26]' : 'text-[hsl(var(--muted-foreground))] hover:text-[#ad8a26]')}><Star className="h-4 w-4" fill={paper.favorite ? 'currentColor' : 'none'} /></button><button onClick={() => onSelect(paper.id)} data-testid={`button-reader-${paper.id}`} className="rounded p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"><BookOpen className="h-4 w-4" /></button></div></div>)}</div>}</div>;
}

function ReaderContent({ paper, toggleFavorite, showHighlights }: { paper: Paper; toggleFavorite: (id: string) => void; showHighlights?: boolean }) {
  const [tab, setTab] = useState('Evidence');
  const [note, setNote] = useState(paper.notes);
  const [saved, setSaved] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [noteState, setNoteState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [liveEvidence, setLiveEvidence] = useState<ApiEvidence[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  useEffect(() => { setNote(paper.notes); }, [paper.id, paper.notes]);

  const saveNote = async () => {
    setNoteState('saving');
    try {
      await updatePaperInBackend(paper.id, { notes: note });
      setNoteState('saved');
      window.setTimeout(() => setNoteState('idle'), 2000);
    } catch {
      setNoteState('error');
    }
  };

  useEffect(() => {
    setEvidenceLoading(true);
    fetchPaperEvidence(paper.id)
      .then(setLiveEvidence)
      .catch(() => setLiveEvidence([]))
      .finally(() => setEvidenceLoading(false));
  }, [paper.id, paper.fileUrl]);

  const tagFor = (i: number) => ['finding', 'observation', 'gap', 'method'][i % 4];
  const labelFor = (i: number) => ['Core finding', 'Evidence note', 'Research gap', 'Method note'][i % 4];

  return <div className="page-in"><div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"><Link href="/library" data-testid="link-reader-library" className="hover:text-[hsl(var(--foreground))]">Library</Link><ChevronRight className="h-3 w-3" /><span className="truncate">{paper.title}</span></div><div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_330px]"><article><div className="mb-6 border-b border-[hsl(var(--border))] pb-6"><div className="flex flex-wrap items-center gap-2"><Badge tone="gold">{paper.status}</Badge><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">Last opened today</span></div><h1 className="mt-4 max-w-4xl font-display text-3xl leading-[1.18] md:text-4xl">{paper.title}</h1><p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">{paper.authors.join(' · ')} · {paper.venue} · {paper.year}</p><div className="mt-5 flex flex-wrap gap-2"><Button onClick={() => toggleFavorite(paper.id)} variant="soft" testId="button-reader-favorite"><Star className="h-4 w-4 text-[#a37f1f]" fill={paper.favorite ? 'currentColor' : 'none'} />{paper.favorite ? 'Favorited' : 'Favorite'}</Button><Button variant="outline" onClick={() => { navigator.clipboard?.writeText(paper.title); setCopyState('copied'); window.setTimeout(() => setCopyState('idle'), 1500); }} testId="button-reader-share"><Clipboard className="h-4 w-4" />{copyState === 'copied' ? 'Copied' : 'Copy title'}</Button><Button variant="ghost" testId="button-reader-more"><MoreHorizontal className="h-4 w-4" />More</Button></div></div>
    <div className="flex gap-5 border-b border-[hsl(var(--border))]"><button onClick={() => setTab('Evidence')} data-testid="tab-reader-evidence" className={cn('border-b-2 px-1 pb-3 text-sm font-semibold', tab === 'Evidence' ? 'border-[#b18d2e] text-[hsl(var(--foreground))]' : 'border-transparent text-[hsl(var(--muted-foreground))]')}>Evidence {liveEvidence.length > 0 && <span className="ml-1 font-mono-ui text-[10px]">{String(liveEvidence.length).padStart(2,'0')}</span>}</button><button onClick={() => setTab('Abstract')} data-testid="tab-reader-abstract" className={cn('border-b-2 px-1 pb-3 text-sm font-semibold', tab === 'Abstract' ? 'border-[#b18d2e] text-[hsl(var(--foreground))]' : 'border-transparent text-[hsl(var(--muted-foreground))]')}>Abstract</button><button onClick={() => setTab('Notes')} data-testid="tab-reader-notes" className={cn('border-b-2 px-1 pb-3 text-sm font-semibold', tab === 'Notes' ? 'border-[#b18d2e] text-[hsl(var(--foreground))]' : 'border-transparent text-[hsl(var(--muted-foreground))]')}>My notes</button></div>
    {tab === 'Evidence' && (
      <div className="pt-5">
        {evidenceLoading && <p className="text-sm text-[hsl(var(--muted-foreground))] animate-pulse">Extracting evidence from paper…</p>}
        {!evidenceLoading && liveEvidence.length > 0 && (
          <div className="space-y-3">
            <div className="mb-3 flex items-center gap-2 rounded-md bg-[#dcebe4] px-3 py-2 text-xs text-[#2c6450]"><Sparkles className="h-3.5 w-3.5" />Extracted by semantic search from your uploaded PDF</div>
            {liveEvidence.map((item, index) => (
              <div key={item.chunk_index} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 transition-colors hover:border-[#cdb05b]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#f1e5bd] font-mono-ui text-[10px] text-[#765815]">0{index + 1}</span><span className="text-xs font-bold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">{labelFor(index)}</span></div>
                  <span className={cn('rounded px-2 py-1 text-[10px] font-semibold', tagFor(index) === 'gap' ? 'bg-[#f3dfd7] text-[#894f42]' : tagFor(index) === 'finding' ? 'bg-[#dcebe4] text-[#2c6450]' : 'bg-[#e1e5ed] text-[#334059]')}>{tagFor(index)}</span>
                </div>
                <p className="mt-4 font-display text-base leading-8 text-[hsl(var(--foreground))]">{item.text}</p>
                <div className="mt-3 flex items-center justify-between font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]"><span>Chunk #{item.chunk_index}</span><span>Relevance {Math.round(item.score * 100)}%</span></div>
              </div>
            ))}
          </div>
        )}
        {!evidenceLoading && liveEvidence.length === 0 && (
          <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-6 text-center">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Evidence is extracted from uploaded PDFs using semantic search.</p>
            <Link href="/library" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#8b6a19] hover:underline"><Upload className="h-3.5 w-3.5" />Go to library</Link>
          </div>
        )}
      </div>
    )}
    {tab === 'Abstract' && <div className="prose prose-sm max-w-2xl pt-6 text-[hsl(var(--foreground))]"><p className="font-display text-xl leading-9">{paper.abstract}</p><p className="text-sm leading-7 text-[hsl(var(--muted-foreground))]">This paper is part of your <strong>Launch your research further.</strong>. Upload it to unlock semantic search, gap detection, and AI-grounded chat.</p></div>}
    {tab === 'Notes' && <div className="pt-6"><textarea value={note} onChange={(e) => { setNote(e.target.value); setNoteState('idle'); }} data-testid="textarea-reader-notes" placeholder="Capture a thought while it is still warm..." className="min-h-[180px] w-full resize-y rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 font-display text-lg leading-8 outline-none placeholder:text-[hsl(var(--muted-foreground))] focus:border-[#bd9d43]" /><div className="mt-3 flex items-center justify-end gap-3"><Button onClick={saveNote} disabled={noteState === 'saving'} testId="button-save-note">{noteState === 'saving' ? 'Saving…' : noteState === 'saved' ? <><Check className="h-4 w-4" />Saved</> : 'Save note'}</Button></div>{noteState === 'error' && <p role="alert" className="mt-2 text-right text-xs text-[#a64e45]">Could not save the note — check your connection and try again.</p>}</div>}
  </article>
  <aside className="space-y-4"><div className="rounded-lg border border-[#d8b65f] bg-[#f6edcf] p-5"><div className="flex items-center gap-2 text-[#80651e]"><Sparkles className="h-4 w-4" /><span className="font-mono-ui text-[10px] uppercase tracking-[.15em]">Pilot signal</span></div><h3 className="mt-4 font-display text-lg leading-6 text-[#283344]">Evidence is grounded in your PDFs</h3><p className="mt-2 text-sm leading-6 text-[#756339]">Semantic search extracts the most relevant chunks from each paper. No invented quotes — only what is in your uploaded files.</p><Link href="/intelligence" data-testid="link-reader-intelligence" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#765815] hover:underline">See research gaps <ArrowUpRight className="h-3.5 w-3.5" /></Link></div><div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><h3 className="font-display text-base">Paper details</h3><div className="mt-4 space-y-3 text-xs"><div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Reading time</span><span className="font-mono-ui">{paper.readTime}</span></div><div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Cited by</span><span className="font-mono-ui">{paper.citedBy}</span></div><div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Pages</span><span className="font-mono-ui">{paper.pages.replace('pp. ', '')}</span></div></div></div><div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><h3 className="font-display text-base">Tags</h3><div className="mt-3 flex flex-wrap gap-2">{paper.tags.map((tag) => <Badge key={tag} tone="muted">#{tag}</Badge>)}</div></div></aside></div></div>;
}

function PaperOrganizer({ paper }: { paper: Paper }) {
  const [collection, setCollection] = useState(paper.collection);
  const [tags, setTags] = useState(paper.tags.join(', '));
  const save = () => { void updatePaperInBackend(paper.id, { collection: collection.trim() || 'My library', tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean) }).catch(() => undefined); };
  return <section className="mb-5 grid gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 md:grid-cols-[1fr_1fr_auto]"><label className="text-xs font-semibold">Collection<input value={collection} onChange={(event) => setCollection(event.target.value)} className="mt-2 h-9 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm font-normal outline-none focus:border-[#bd9d43]" placeholder="My library" /></label><label className="text-xs font-semibold">Tags<input value={tags} onChange={(event) => setTags(event.target.value)} className="mt-2 h-9 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm font-normal outline-none focus:border-[#bd9d43]" placeholder="AI, review, important" /></label><Button variant="soft" onClick={save} className="self-end">Save</Button></section>;
}

function ReaderPage({ paper, papers, onSelect, toggleFavorite, focusMode, showHighlights }: { paper: Paper; papers: Paper[]; onSelect: (id: string) => void; toggleFavorite: (id: string) => void; focusMode?: boolean; showHighlights?: boolean }) {
  return <div className="page-in">
    {!focusMode && papers.length > 1 && <div className="mb-4 flex items-center gap-3"><label className="whitespace-nowrap text-xs font-semibold text-[hsl(var(--muted-foreground))]">Reading now</label><div className="relative flex-1 max-w-md"><BookOpen className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" /><select value={paper.id} onChange={(event) => onSelect(event.target.value)} data-testid="select-reader-paper" className="h-10 w-full appearance-none rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-9 pr-8 text-sm font-semibold outline-none focus:border-[#bd9d43]">{papers.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" /></div><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{papers.length} papers</span></div>}
    {!focusMode && <PaperOrganizer paper={paper} />}<div className="mb-7 overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-3"><div><h2 className="font-display text-lg">Source PDF</h2><p className="text-xs text-[hsl(var(--muted-foreground))]">{paper.sourceName || paper.title}</p></div>{paper.fileUrl && <a href={paper.fileUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#92701d] hover:underline">Open PDF</a>}</div>{paper.fileUrl ? <iframe title={`PDF preview for ${paper.title}`} src={paper.fileUrl} className="h-[min(70vh,720px)] w-full" /> : <div className="p-5 text-sm text-[hsl(var(--muted-foreground))]">PDF preview is unavailable</div>}</div><ReaderContent paper={paper} toggleFavorite={toggleFavorite} showHighlights={showHighlights !== false} /></div>;
}

function IntelligencePage({ papers }: { papers: Paper[] }) {
  const [active, setActive] = useState('Gaps');
  const [apiGaps, setApiGaps] = useState<ApiGap[]>([]);
  const [apiRoadmap, setApiRoadmap] = useState<ApiRoadmapStep[]>([]);
  const [apiComparison, setApiComparison] = useState<ApiComparison[]>([]);
  const [loading, setLoading] = useState(false);
  const [backendError, setBackendError] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!papers.length) return;
    setLoading(true);
    Promise.all([fetchGaps(5), fetchRoadmap(5), fetchComparison()])
      .then(([gapsData, roadmapData, comparisonData]) => {
        setApiGaps(gapsData);
        setApiRoadmap(roadmapData);
        setApiComparison(comparisonData);
        setBackendError(false);
      })
      .catch(() => setBackendError(true))
      .finally(() => setLoading(false));
  }, [papers.length, refreshTick]);

  if (!papers.length) return <div className="page-in"><PageTitle eyebrow="Research intelligence" title="See beyond the papers." description="Patterns and research gaps will appear here once you have added evidence to your library." /><EmptyState title="Add papers to unlock intelligence" detail="ResearchPilot needs papers from your library before it can compare methods, surface gaps, or suggest a roadmap." action={<Link href="/library" className="inline-flex h-9 items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-3 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:opacity-90" data-testid="link-intelligence-library"><Library className="h-4 w-4" />Open library</Link>} /></div>;

  const hasLiveGaps = apiGaps.length > 0;
  const hasLiveRoadmap = apiRoadmap.length > 0;
  const hasLiveComparison = apiComparison.length >= 2;

  const activeGapsList = hasLiveGaps
    ? apiGaps.map((g) => ({ title: g.title, confidence: Math.round(g.similarity_score * 100), evidence: g.evidence, tags: [g.gap_type.replace('_', ' ')], sources: 1, paperTitle: g.paper_title }))
    : gaps.map((g) => ({ ...g, paperTitle: undefined as string | undefined }));

  return <div className="page-in">
    <PageTitle eyebrow="Research intelligence" title="See beyond the papers." description="Patterns, absences, and possible next moves — grounded in the evidence you have collected." action={<Button variant="outline" onClick={() => { setActive('Roadmap'); setRefreshTick((tick) => tick + 1); }} disabled={loading} testId="button-generate-roadmap"><Sparkles className="h-4 w-4" />{loading ? 'Analysing…' : 'Generate roadmap'}</Button>} />

    {backendError && (
      <div className="mb-5 flex items-center gap-2 rounded-md border border-[#e5c9c2] bg-[#f8e9e4] px-4 py-3 text-sm text-[#894f42]">
        <Info className="h-4 w-4 shrink-0" />
        Backend unreachable — showing demo data below (not from your library). Make sure the FastAPI server is running on port 8000.
      </div>
    )}
    {loading && (
      <div className="mb-5 flex items-center gap-2 rounded-md border border-[#d8b65f] bg-[#f6edcf] px-4 py-3 text-sm text-[#80651e] animate-pulse">
        <Sparkles className="h-4 w-4" />Analysing your library with semantic search…
      </div>
    )}    

    <div className="mb-6 flex gap-1 border-b border-[hsl(var(--border))]">{['Gaps', 'Compare', 'Roadmap'].map((tab) => <button key={tab} onClick={() => setActive(tab)} data-testid={`tab-intelligence-${tab.toLowerCase()}`} className={cn('border-b-2 px-4 pb-3 text-sm font-semibold', active === tab ? 'border-[#b18d2e]' : 'border-transparent text-[hsl(var(--muted-foreground))]')}>{tab}</button>)}</div>
    {active === 'Gaps' && <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]"><div className="space-y-3">{activeGapsList.map((gap, index) => <div key={gap.title + index} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 transition-all hover:-translate-y-0.5 hover:border-[#cdb05b]"><div className="flex items-start justify-between gap-4"><div className="flex gap-3"><span className="font-mono-ui text-xs text-[#9b7921]">0{index + 1}</span><div><h2 className="font-display text-lg leading-6">{gap.title}</h2><div className="mt-2 flex flex-wrap gap-2">{gap.tags.map((tag) => <Badge key={tag} tone="muted">#{tag}</Badge>)}</div></div></div><div className="shrink-0 text-right"><div className="font-mono-ui text-lg text-[#99761f]">{gap.confidence}%</div><div className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">similarity</div></div></div><p className="mt-4 border-l-2 border-[#d7b553] pl-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{gap.evidence}</p><div className="mt-4 flex items-center justify-between text-[10px] text-[hsl(var(--muted-foreground))]"><span>{gap.paperTitle ? `Source: ${gap.paperTitle}` : `${gap.sources} source papers`}</span><button data-testid={`button-explore-gap-${index}`} className="font-semibold text-[#8b6a19] hover:underline">Explore evidence <ArrowUpRight className="ml-1 inline h-3 w-3" /></button></div></div>)}</div><div className="rounded-lg border border-[#d8b65f] bg-[#f6edcf] p-6"><div className="flex h-full flex-col justify-between"><div><div className="flex items-center gap-2 text-[#80651e]"><Network className="h-4 w-4" /><span className="font-mono-ui text-[10px] uppercase tracking-[.15em]">How this works</span></div><h2 className="mt-5 max-w-sm font-display text-2xl leading-8 text-[#283344]">Gaps are signals, not conclusions.</h2><p className="mt-3 max-w-sm text-sm leading-6 text-[#756339]">ResearchPilot looks for claims that outpace their evidence, methods that cannot be compared, and questions that keep returning without an answer.</p></div><div className="mt-8 border-t border-[#dfc878] pt-4 text-xs leading-5 text-[#806d3d]"><Info className="mr-1 inline h-3.5 w-3.5" />Your library is the source of every signal. No web search, no invented sources.</div></div></div></div>}
    {active === 'Compare' && (() => {
      if (!hasLiveComparison) return <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8"><EmptyState title="Not enough papers to compare" detail="Upload at least two papers and the comparison table will build itself from their extracted metadata and keywords." /></div>;
      const paperA = apiComparison[0];
      const paperB = apiComparison[1];
      const sharedKeywords = paperA.keywords.filter((keyword) => paperB.keywords.some((other) => other.toLowerCase() === keyword.toLowerCase()));
      const rows: Array<[string, string, string]> = [
        ['Year', String(paperA.year ?? '—'), String(paperB.year ?? '—')],
        ['Keywords', paperA.keywords.slice(0, 4).join(', ') || '—', paperB.keywords.slice(0, 4).join(', ') || '—'],
        ['Shared keywords', sharedKeywords.length ? sharedKeywords.join(', ') : 'None detected', sharedKeywords.length ? `${sharedKeywords.length} overlap` : '—'],
        ['Research question', paperA.abstract ? paperA.abstract.slice(0, 140) + (paperA.abstract.length > 140 ? '…' : '') : 'No abstract extracted', paperB.abstract ? paperB.abstract.slice(0, 140) + (paperB.abstract.length > 140 ? '…' : '') : 'No abstract extracted'],
        ['Scale', `${paperA.sentence_count} sentences indexed`, `${paperB.sentence_count} sentences indexed`],
      ];
      return <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]"><div className="grid gap-4 border-b border-[hsl(var(--border))] p-5 md:grid-cols-2"><div className="rounded-md border border-[#d8b65f] bg-[#fbf4df] p-4"><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[#80651e]">Study A</div><h3 className="mt-2 font-display text-lg">{paperA.title}</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{paperA.keywords.slice(0, 3).join(', ') || 'Paper analysis'}</p></div><div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4"><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Study B</div><h3 className="mt-2 font-display text-lg">{paperB.title}</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{paperB.keywords.slice(0, 3).join(', ') || 'Paper analysis'}</p></div></div><div className="divide-y divide-[hsl(var(--border))]">{rows.map(([label, a, b]) => <div key={label} className="grid gap-2 px-5 py-4 text-sm md:grid-cols-[150px_1fr_1fr]"><span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{label}</span><span>{a}</span><span>{b}</span></div>)}</div></div>;
    })()}
    {active === 'Roadmap' && <div className="grid gap-4 md:grid-cols-3">{(hasLiveRoadmap
      ? apiRoadmap.map((r) => ({ number: `0${r.step}`, title: r.gap, copy: r.objective, phase: r.phase || 'next', methodology: r.methodology, metrics: r.metrics, problem: r.problem }))
      : [['01', 'Map the recovery moment', 'Design a longitudinal diary study around the 24 hours after a reading session.', 'next'], ['02', 'Instrument the handoff', 'Capture what gets lost between annotation, synthesis, and writing.', 'then'], ['03', 'Test the intervention', 'Compare lightweight thread cues with existing research routines.', 'later']].map(([number, title, copy, phase]) => ({ number, title, copy, phase, methodology: null, metrics: [], problem: null }))).map((step) => <div key={step.number} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><span className="font-mono-ui text-xs text-[#a27d20]">{step.number} / {step.phase}</span><h2 className="mt-4 font-display text-xl">{step.title}</h2><p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{step.copy}</p>{step.methodology && <p className="mt-3 border-l-2 border-[#d7b553] pl-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{step.methodology}</p>}{step.metrics && step.metrics.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{step.metrics.map((metric) => <Badge key={metric} tone="ink">{metric}</Badge>)}</div>}<button data-testid={`button-roadmap-${step.number}`} className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-[#8b6a19] hover:underline">Add to project <Plus className="h-3.5 w-3.5" /></button></div>)}</div>}
  </div>;
}

function formatCitation(paper: Paper, style: 'APA' | 'IEEE' | 'MLA'): string {
  const authors = paper.authors.filter((author) => author && author !== 'Uploaded by you');
  const authorList = authors.length ? authors : ['Unknown Author'];
  const title = paper.title || 'Untitled';
  const year = paper.year || new Date().getFullYear();
  const venue = paper.venue && paper.venue !== 'Personal library' ? paper.venue : null;
  const pages = paper.pages && paper.pages !== 'PDF upload' && paper.pages !== 'Backend analysis' && paper.pages !== '' ? paper.pages : null;
  const doi = paper.doi ?? null;
  const volume = paper.volume ?? null;
  const issue = paper.issue ?? null;
  const articleNumber = paper.articleNumber ?? null;

  if (style === 'APA') {
    // APA 7: Last, F. I. (Year). Title. Journal, volume(issue), pages. https://doi.org/...
    const apaAuthors = authorList.map((name) => {
      const parts = name.trim().split(/\s+/);
      const last = parts[parts.length - 1];
      const initials = parts.slice(0, -1).map((p) => (p[0] ? `${p[0]}.` : '')).join(' ');
      return initials ? `${last}, ${initials}` : last;
    });
    const apaAuthorStr = apaAuthors.length > 1
      ? `${apaAuthors.slice(0, -1).join(', ')}, & ${apaAuthors[apaAuthors.length - 1]}`
      : apaAuthors[0];
    let citation = `${apaAuthorStr} (${year}). ${title}.`;
    if (venue) {
      citation += ` ${venue}`;
      if (volume) { citation += `, ${volume}`; if (issue) citation += `(${issue})`; }
      if (pages) citation += `, ${pages}`;
      else if (articleNumber) citation += `, ${articleNumber}`;
      citation += '.';
    }
    if (doi) citation += ` https://doi.org/${doi}`;
    return citation;
  }

  if (style === 'IEEE') {
    // IEEE: F. Last, "Title," Journal, vol. X, no. Y, Art. no. Z / pp. Z, year, doi: ...
    const ieeeAuthors = authorList.map((name) => {
      const parts = name.trim().split(/\s+/);
      const last = parts[parts.length - 1];
      const initials = parts.slice(0, -1).map((p) => (p[0] ? `${p[0]}.` : '')).filter(Boolean).join(' ');
      return initials ? `${initials} ${last}` : last;
    });
    const ieeeAuthorStr = ieeeAuthors.length > 1
      ? `${ieeeAuthors.slice(0, -1).join(', ')} and ${ieeeAuthors[ieeeAuthors.length - 1]}`
      : ieeeAuthors[0];
    let citation = `${ieeeAuthorStr}, "${title},"`;
    if (venue) citation += ` ${venue},`;
    if (volume) { citation += ` vol. ${volume},`; if (issue) citation += ` no. ${issue},`; }
    // Use "Art. no." for article numbers; "pp." for real page ranges (contain digits and a dash)
    if (articleNumber) citation += ` Art. no. ${articleNumber},`;
    else if (pages) citation += ` pp. ${pages},`;
    citation += ` ${year}.`;
    if (doi) citation += ` doi: ${doi}.`;
    return citation;
  }

  // MLA 9: Last, First, and First Last. "Title." Journal, vol. X, no. Y, Year, pp. Z.
  const mlaAuthors = authorList.length > 1
    ? `${authorList[0]}, and ${authorList[authorList.length - 1]}`
    : authorList[0];
  let citation = `${mlaAuthors}. "${title}."`;
  if (venue) citation += ` ${venue},`;
  if (volume) { citation += ` vol. ${volume},`; if (issue) citation += ` no. ${issue},`; }
  citation += ` ${year}`;
  if (pages) citation += `, pp. ${pages}`;
  else if (articleNumber) citation += `, Art. no. ${articleNumber}`;
  citation += '.';
  if (doi) citation += ` https://doi.org/${doi}`;
  return citation;
}

function CitationsPage({ papers, defaultStyle }: { papers: Paper[]; defaultStyle?: 'APA' | 'IEEE' | 'MLA' }) {
  const [style, setStyle] = useState<'APA' | 'IEEE' | 'MLA'>(defaultStyle ?? 'APA');
  const [copied, setCopied] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(() => papers.slice(0, 2).map((paper) => paper.id));
  useEffect(() => {
    setSelected((current) => {
      const valid = current.filter((id) => papers.some((paper) => paper.id === id));
      return valid.length ? valid : papers.slice(0, 2).map((paper) => paper.id);
    });
  }, [papers]);
  const key = style.toLowerCase() as 'apa' | 'ieee' | 'mla';
  const toggle = (id: string) => setSelected((items) => items.includes(id) ? items.filter((x) => x !== id) : [...items, id]);
  const copy = (text: string, id: string) => { navigator.clipboard?.writeText(text); setCopied(id); window.setTimeout(() => setCopied(null), 1500); };
  const selectedPapers = selected.map((id) => papers.find((paper) => paper.id === id)).filter((paper): paper is Paper => Boolean(paper));
  const bibliography = selectedPapers.map((paper) => formatCitation(paper, style)).join('\n');
  return <div className="page-in"><PageTitle eyebrow="Citation desk" title="Ready when your argument is." description="Format selected sources, copy a single reference, or export the thread as a bibliography." action={<Button onClick={() => copy(bibliography, 'all')} testId="button-export-citations"><FileText className="h-4 w-4" />{copied === 'all' ? 'Copied' : 'Copy bibliography'}</Button>} /><div className="grid gap-5 xl:grid-cols-[310px_minmax(0,1fr)]"><aside className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]"><div className="border-b border-[hsl(var(--border))] p-4"><div className="flex items-center justify-between"><h2 className="font-display text-lg">Sources</h2><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{selected.length} selected</span></div><div className="mt-3 flex gap-1 rounded-md bg-[hsl(var(--muted))] p-1">{(['APA', 'IEEE', 'MLA'] as const).map((item) => <button key={item} onClick={() => setStyle(item)} data-testid={`button-style-${item.toLowerCase()}`} className={cn('flex-1 rounded px-2 py-1.5 text-[10px] font-bold transition-colors', style === item ? 'bg-[hsl(var(--card))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]')}>{item}</button>)}</div></div>{papers.map((paper) => <button key={paper.id} onClick={() => toggle(paper.id)} data-testid={`button-select-citation-${paper.id}`} className="flex w-full items-start gap-3 border-b border-[hsl(var(--border))] p-4 text-left last:border-0 hover:bg-[hsl(var(--muted))]/50"><span className={cn('mt-0.5 grid h-4 w-4 place-items-center rounded border', selected.includes(paper.id) ? 'border-[#b49337] bg-[#d3b353] text-[#263042]' : 'border-[hsl(var(--border))]')}>{selected.includes(paper.id) && <Check className="h-3 w-3" />}</span><span><span className="block text-xs font-semibold leading-5">{paper.title}</span><span className="mt-1 block text-[10px] text-[hsl(var(--muted-foreground))]">{paper.year} · {paper.authors[0]}</span></span></button>)}</aside><section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4"><div><h2 className="font-display text-lg">{style} references</h2><p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">Formatted from your library metadata</p></div><Badge tone="green"><Check className="mr-1 h-3 w-3" />Export-ready</Badge></div>{selected.length === 0 ? <div className="p-5"><EmptyState title="Select a source" detail="Choose one or more papers to build a citation-ready reference list." /></div> : <div className="divide-y divide-[hsl(var(--border))]">{selectedPapers.map((paper) => <div key={paper.id} className="group p-5"><div className="mb-3 flex items-center justify-between"><span className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{paper.authors[0]} · {paper.year}</span><button onClick={() => copy(formatCitation(paper, style), paper.id)} data-testid={`button-copy-citation-${paper.id}`} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold text-[#8b6a19] opacity-0 transition-opacity hover:bg-[#f4e7bd] group-hover:opacity-100">{copied === paper.id ? <Check className="h-3 w-3" /> : <Clipboard className="h-3 w-3" />}{copied === paper.id ? 'Copied' : 'Copy'}</button></div><p className="max-w-3xl font-serif text-sm leading-7">{formatCitation(paper, style)}</p></div>)}</div>}</section></div></div>;
}

async function askBackend(question: string): Promise<{ answer: string; sources: Array<{ paper_title: string; similarity_score: number }>; status: string }> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...apiHeaders() }, body: JSON.stringify({ question, top_k: 3 }) });
  if (!response.ok) throw new Error('Unable to ask the research backend');
  return response.json();
}

type ChatMessage = { role: 'user' | 'assistant'; text: string; sources?: Array<{ paper_title: string; similarity_score: number }>; status?: string; pending?: boolean };

function ChatPage({ papers, showSources, showScores }: { papers: Paper[]; showSources?: boolean; showScores?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', text: `I’m grounded in the ${papers.length} paper${papers.length === 1 ? '' : 's'} in your library. Ask me to compare methods, trace a claim, or find what is missing.` }]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);
  const submit = async () => {
    if (!input.trim()) return;
    const question = input.trim();
    setInput('');
    setMessages((items) => [...items, { role: 'user', text: question }, { role: 'assistant', text: 'Searching your library…', pending: true }]);
    try {
      const result = await askBackend(question);
      setMessages((items) => {
        const next = [...items];
        next[next.length - 1] = { role: 'assistant', text: result.answer, sources: result.sources, status: result.status };
        return next;
      });
    } catch {
      setMessages((items) => {
        const next = [...items];
        next[next.length - 1] = { role: 'assistant', text: papers.length ? 'Backend unavailable right now — please try again once the FastAPI server is running.' : 'Backend unavailable. Add a paper to your library first.' };
        return next;
      });
    }
  };
  const statusLabel = (status?: string) => status === 'generated' ? 'Gemini answer · grounded in evidence' : status === 'fallback' ? 'Retrieved evidence (AI unavailable)' : status === 'no_evidence' ? 'No matching evidence found' : null;
  return <div className="page-in"><PageTitle eyebrow="Grounded conversation" title="Ask the library." description="A thinking partner that stays inside your evidence base. Every answer points back to a source." /><div className="mx-auto max-w-3xl overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]"><div className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-5 py-4"><div className="grid h-8 w-8 place-items-center rounded-md bg-[#f1e5bd] text-[#80651e]"><MessageSquare className="h-4 w-4" /></div><div><div className="text-sm font-semibold">Library companion</div><div className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{papers.length} sources · grounded mode</div></div><span className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold text-[#46705f]"><span className="h-1.5 w-1.5 rounded-full bg-[#5a9a7b]" />Ready</span></div><div ref={scrollRef} className="max-h-[55vh] min-h-[390px] space-y-5 overflow-y-auto p-5">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={cn('flex gap-3', message.role === 'user' && 'justify-end')}><div className={cn('max-w-[85%] rounded-lg px-4 py-3 text-sm leading-6', message.role === 'assistant' ? 'bg-[hsl(var(--muted))]' : 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]')}><p className={cn(message.pending && 'animate-pulse text-[hsl(var(--muted-foreground))]')}>{message.text}</p>{message.role === 'assistant' && !message.pending && message.sources && message.sources.length > 0 && (showSources !== false) && <div className="mt-3 space-y-1 border-t border-[hsl(var(--border))] pt-2"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]" style={{ display: 'none' }} /><span className="flex items-center gap-2 text-[10px] font-semibold text-[#92701d]" style={{ display: 'none' }} />{statusLabel(message.status) && <div className="mb-1 text-[10px] font-semibold text-[#80651e]">{statusLabel(message.status)}</div>}{message.sources.slice(0, 3).map((source, sourceIndex) => <div key={sourceIndex} className="flex items-center gap-2 text-[10px] text-[hsl(var(--muted-foreground))]"><BookOpen className="h-3 w-3 shrink-0" /><span className="truncate">{source.paper_title}</span>{(showScores !== false) && <span className="ml-auto font-mono-ui">{Math.round(source.similarity_score * 100)}%</span>}</div>)}</div>}</div></div>)}</div><form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="border-t border-[hsl(var(--border))] p-4"><div className="flex items-end gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2 focus-within:border-[#b9983f]"><textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} data-testid="textarea-chat-input" rows={1} placeholder="Ask about your evidence..." className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]" /><button type="submit" disabled={!input.trim() || messages.some((message) => message.pending)} data-testid="button-submit-chat" className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#d4b150] text-[#253044] transition-opacity hover:opacity-85 disabled:opacity-40"><Send className="h-4 w-4" /></button></div><div className="mt-2 flex flex-wrap gap-2">{['What gaps are emerging?', 'Compare the methods', 'Find a supporting quote'].map((prompt) => <button type="button" key={prompt} onClick={() => setInput(prompt)} data-testid={`button-prompt-${prompt.slice(0, 5).toLowerCase()}`} className="rounded-full border border-[hsl(var(--border))] px-3 py-1.5 text-[10px] text-[hsl(var(--muted-foreground))] hover:border-[#c4a448] hover:text-[hsl(var(--foreground))]">{prompt}</button>)}</div></form></div></div>;
}

function SettingsPage({ displayName, onSignOut, settings, onSave }: { displayName: string; onSignOut: () => void; settings: AppSettings; onSave: (s: AppSettings) => void }) {
  const [researchArea, setResearchArea] = useState(settings.researchArea);
  const [citationStyle, setCitationStyle] = useState<"APA"|"IEEE"|"MLA">(settings.citationStyle);
  const [focus, setFocus] = useState(settings.focusModeOnOpen);
  const [compact, setCompact] = useState(settings.compactLibraryRows);
  const [showHighlights, setShowHighlights] = useState(settings.showEvidenceHighlights);
  const [inclSources, setInclSources] = useState(settings.includeSourceEvidence);
  const [showScores, setShowScores] = useState(settings.showSimilarityScores);
  const [searchResults, setSearchResults] = useState<5|10|20>(settings.defaultSearchResults);
  const [saved, setSaved] = useState(false);
  const initials = displayName.split(' ').map((p) => p[0]).join('').slice(0,2).toUpperCase();
  const handleSave = () => { const next: AppSettings = { researchArea: researchArea.trim() || SETTINGS_DEFAULTS.researchArea, citationStyle, focusModeOnOpen: focus, compactLibraryRows: compact, showEvidenceHighlights: showHighlights, includeSourceEvidence: inclSources, showSimilarityScores: showScores, defaultSearchResults: searchResults }; onSave(next); setSaved(true); window.setTimeout(() => setSaved(false), 1600); };
  const handleReset = () => { setResearchArea(SETTINGS_DEFAULTS.researchArea); setCitationStyle(SETTINGS_DEFAULTS.citationStyle); setFocus(SETTINGS_DEFAULTS.focusModeOnOpen); setCompact(SETTINGS_DEFAULTS.compactLibraryRows); setShowHighlights(SETTINGS_DEFAULTS.showEvidenceHighlights); setInclSources(SETTINGS_DEFAULTS.includeSourceEvidence); setShowScores(SETTINGS_DEFAULTS.showSimilarityScores); setSearchResults(SETTINGS_DEFAULTS.defaultSearchResults); };
  return <div className="page-in"><PageTitle eyebrow="Workspace settings" title="Make it yours." description="Small preferences for a workspace that stays out of the way of your thinking." /><div className="grid max-w-4xl gap-5 lg:grid-cols-[1fr_270px]"><div className="space-y-5"><section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]"><div className="border-b border-[hsl(var(--border))] p-5"><h2 className="font-display text-lg">Workspace profile</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Visible only to you</p></div><div className="grid gap-4 p-5 md:grid-cols-2"><label className="text-xs font-semibold">Research area<input value={researchArea} onChange={(e) => setResearchArea(e.target.value)} data-testid="input-research-area" placeholder="e.g. Computer Science" className="mt-2 h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm outline-none focus:border-[#bd9d43]" /></label><label className="text-xs font-semibold">Default citation style<select value={citationStyle} onChange={(e) => setCitationStyle(e.target.value as "APA"|"IEEE"|"MLA")} data-testid="select-citation-style" className="mt-2 h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm outline-none focus:border-[#bd9d43]"><option value="APA">APA</option><option value="IEEE">IEEE</option><option value="MLA">MLA</option></select></label></div></section><section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]"><div className="border-b border-[hsl(var(--border))] p-5"><h2 className="font-display text-lg">Reading preferences</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Tune the workspace to your rhythm</p></div><div className="divide-y divide-[hsl(var(--border))]"><label className="flex cursor-pointer items-center justify-between p-5"><span><span className="block text-sm font-semibold">Focus mode on open</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Hide secondary panels when you enter the reader</span></span><input type="checkbox" checked={focus} onChange={(e) => setFocus(e.target.checked)} data-testid="switch-focus-mode" className="h-4 w-4 accent-[#b18d2e]" /></label><label className="flex cursor-pointer items-center justify-between p-5"><span><span className="block text-sm font-semibold">Compact library rows</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Fit more evidence on screen</span></span><input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} data-testid="switch-compact-rows" className="h-4 w-4 accent-[#b18d2e]" /></label><label className="flex cursor-pointer items-center justify-between p-5"><span><span className="block text-sm font-semibold">Show evidence highlights</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Highlight retrieved evidence passages in the reader</span></span><input type="checkbox" checked={showHighlights} onChange={(e) => setShowHighlights(e.target.checked)} data-testid="switch-show-highlights" className="h-4 w-4 accent-[#b18d2e]" /></label></div></section><section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]"><div className="border-b border-[hsl(var(--border))] p-5"><h2 className="font-display text-lg">Research preferences</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Adjust how AI answers and search results are displayed</p></div><div className="divide-y divide-[hsl(var(--border))]"><label className="flex cursor-pointer items-center justify-between p-5"><span><span className="block text-sm font-semibold">Include source evidence in AI answers</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Show the source papers used to generate each answer</span></span><input type="checkbox" checked={inclSources} onChange={(e) => setInclSources(e.target.checked)} data-testid="switch-incl-sources" className="h-4 w-4 accent-[#b18d2e]" /></label><label className="flex cursor-pointer items-center justify-between p-5"><span><span className="block text-sm font-semibold">Show similarity scores</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Display retrieval confidence percentages next to sources</span></span><input type="checkbox" checked={showScores} onChange={(e) => setShowScores(e.target.checked)} data-testid="switch-show-scores" className="h-4 w-4 accent-[#b18d2e]" /></label><div className="flex items-center justify-between p-5"><span><span className="block text-sm font-semibold">Default search results</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Number of semantic search results to retrieve</span></span><select value={searchResults} onChange={(e) => setSearchResults(Number(e.target.value) as 5|10|20)} data-testid="select-search-results" className="h-9 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm outline-none focus:border-[#bd9d43]"><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option></select></div></div></section><div className="flex items-center justify-between"><button onClick={handleReset} className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:underline">Reset to defaults</button><Button onClick={handleSave} testId="button-save-settings">{saved ? <><Check className="h-4 w-4" />Saved</> : 
'Save preferences'
}</Button></div></div><aside className="rounded-lg border border-[#d8b65f] bg-[#f6edcf] p-5"><div className="flex items-center gap-2 text-[#80651e]"><Settings className="h-4 w-4" /><span className="font-mono-ui text-[10px] uppercase tracking-[.15em]">Your workspace</span></div><div className="mt-8 grid h-20 w-20 place-items-center rounded-full border-4 border-[#d8b65f] bg-[#fbf4df] font-display text-2xl text-[#80651e]">{initials}</div><h2 className="mt-4 font-display text-lg text-[#283344]">{displayName}</h2><p className="mt-1 text-xs leading-5 text-[#806d3d]">Researcher<br />Evidence workspace</p><div className="mt-6 border-t border-[#dfc878] pt-4 font-mono-ui text-[10px] text-[#806d3d]">Signed in locally</div><Button variant="outline" onClick={onSignOut} className="mt-4 w-full" testId="button-settings-signout">Sign out</Button></aside></div></div>;
}
function RouterView({ papers, selectedId, setSelectedId, toggleFavorite, displayName, onSignOut }: { papers: Paper[]; selectedId: string; setSelectedId: (id: string) => void; toggleFavorite: (id: string) => void; displayName: string; onSignOut: () => void }) {
  const [, setLocation] = useLocation();
  const [appSettings, setAppSettings] = useState<AppSettings>(() => loadSettings());
  const selectedPaper = papers.find((p) => p.id === selectedId) ?? papers[0];
  const openReader = (id: string) => { setSelectedId(id); setLocation('/reader'); };
  const handleSaveSettings = (s: AppSettings) => { setAppSettings(s); saveSettings(s); };
  return <Shell papers={papers} selectedId={selectedPaper?.id ?? ''} setSelectedId={setSelectedId} displayName={displayName} onSignOut={onSignOut}><Switch><Route path="/"><Dashboard papers={papers} onSelect={openReader} toggleFavorite={toggleFavorite} /></Route><Route path="/dashboard"><Dashboard papers={papers} onSelect={openReader} toggleFavorite={toggleFavorite} /></Route><Route path="/library"><LibraryPage papers={papers} onSelect={openReader} toggleFavorite={toggleFavorite} compact={appSettings.compactLibraryRows} /></Route><Route path="/reader">{selectedPaper ? <ReaderPage paper={selectedPaper} papers={papers} onSelect={openReader} toggleFavorite={toggleFavorite} focusMode={appSettings.focusModeOnOpen} showHighlights={appSettings.showEvidenceHighlights} /> : <div className="page-in"><PageTitle eyebrow="Reader" title="Nothing to read yet." description="Add a paper to your library before opening the reader." /><EmptyState title="Your reader is waiting" detail="Your first uploaded paper will appear here with evidence, notes, and reading progress." action={<Link href="/library" className="inline-flex h-9 items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-3 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:opacity-90" data-testid="link-reader-library"><Library className="h-4 w-4" />Open library</Link>} /></div>}</Route><Route path="/intelligence"><IntelligencePage papers={papers} /></Route><Route path="/citations"><CitationsPage papers={papers} defaultStyle={appSettings.citationStyle} /></Route><Route path="/chat"><ChatPage papers={papers} showSources={appSettings.includeSourceEvidence} showScores={appSettings.showSimilarityScores} /></Route><Route path="/settings"><SettingsPage displayName={displayName} onSignOut={onSignOut} settings={appSettings} onSave={handleSaveSettings} /></Route><Route component={NotFound} /></Switch></Shell>;
}

function HomeLanding() {
  return <main className="paper-grain min-h-[100dvh] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"><div className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-6 py-6 md:px-10"><header className="flex items-center justify-between"><Link href="/" className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-md bg-[#e2bf5a] text-[#202838]"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="14" width="14" height="3" rx="1"/><rect x="5" y="10" width="14" height="3" rx="1"/><rect x="7" y="6" width="14" height="3" rx="1"/><path d="M19 3c0 0 1 1 1 3s-1 3-1 3" strokeWidth="1.5"/><path d="M21 4.5 L23 2" strokeWidth="1.5"/></svg></span><span><span className="block font-display text-lg">ResearchPilot</span><span className="block font-mono-ui text-[9px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Launch your research further.</span></span></Link><div className="flex items-center gap-2"><Link href="/sign-in" className="rounded-md px-3 py-2 text-sm font-semibold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]">Sign in</Link><Link href="/sign-up" className="rounded-md bg-[hsl(var(--primary))] px-3 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:opacity-90">Create account</Link></div></header><section className="grid flex-1 items-center gap-12 py-20 lg:grid-cols-[1.05fr_.95fr]"><div><div className="mb-4 font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#92701d]">A clearer way to do the work</div><h1 className="max-w-3xl font-display text-5xl leading-[1.05] md:text-7xl">Your research, with a <span className="text-[#9a7822]">stronger thread.</span></h1><p className="mt-6 max-w-xl text-base leading-7 text-[hsl(var(--muted-foreground))] md:text-lg">Organize the papers that matter, read the evidence in context, and see what your library is trying to tell you next.</p><div className="mt-8 flex flex-wrap items-center gap-3"><Link href="/sign-up" className="inline-flex h-11 items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-5 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-sm hover:opacity-90">Start your workspace <ArrowUpRight className="h-4 w-4" /></Link><Link href="/sign-in" className="inline-flex h-11 items-center rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 text-sm font-semibold hover:border-[#c5a64f]">Sign in to continue</Link></div><div className="mt-10 flex flex-wrap gap-6 text-xs text-[hsl(var(--muted-foreground))]"><span className="flex items-center gap-2"><Check className="h-4 w-4 text-[#9a7822]" />Evidence-first workspace</span><span className="flex items-center gap-2"><Check className="h-4 w-4 text-[#9a7822]" />Built for serious reading</span></div></div><div className="relative rounded-xl border border-[#d8b65f] bg-[#f6edcf] p-5 shadow-[0_24px_60px_rgba(45,39,25,.10)] md:p-7"><div className="absolute -right-3 -top-3 rounded-md bg-[#202838] px-3 py-2 font-mono-ui text-[10px] uppercase tracking-[.12em] text-[#f6edcf]">Your evidence, distilled</div><div className="rounded-lg border border-[#dfc878] bg-[#fbf4df] p-5"><div className="flex items-center justify-between"><span className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[#80651e]">Research pulse</span><Zap className="h-4 w-4 text-[#9b7921]" /></div><h2 className="mt-5 font-display text-2xl leading-8 text-[#283344]">The strongest gap is hiding between attention and method.</h2><p className="mt-4 text-sm leading-6 text-[#756339]">Six studies mention deep reading. Only two measure what happens after the session ends.</p><div className="mt-6 border-t border-[#dfc878] pt-4"><div className="flex items-center justify-between text-[10px] text-[#806d3d]"><span>Connected evidence</span><span>6 sources</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e8d9a9]"><div className="h-full w-[78%] rounded-full bg-[#b9932f]" /></div></div></div></div></section><footer className="border-t border-[hsl(var(--border))] py-5 text-xs text-[hsl(var(--muted-foreground))]">ResearchPilot AI · A focused workspace for evidence, ideas, and the next useful question.</footer></div></main>;
}

function SignInPage() {
  return <div className="paper-grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-4 py-10"><div className="w-full max-w-[440px]"><Link href="/" className="mb-6 flex items-center justify-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-md bg-[#e2bf5a] text-[#202838]"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="14" width="14" height="3" rx="1"/><rect x="5" y="10" width="14" height="3" rx="1"/><rect x="7" y="6" width="14" height="3" rx="1"/><path d="M19 3c0 0 1 1 1 3s-1 3-1 3" strokeWidth="1.5"/><path d="M21 4.5 L23 2" strokeWidth="1.5"/></svg></span><span className="font-display text-xl">ResearchPilot</span></Link><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div></div>;
}

function SignUpPage() {
  return <div className="paper-grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-4 py-10"><div className="w-full max-w-[440px]"><Link href="/" className="mb-6 flex items-center justify-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-md bg-[#e2bf5a] text-[#202838]"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="14" width="14" height="3" rx="1"/><rect x="5" y="10" width="14" height="3" rx="1"/><rect x="7" y="6" width="14" height="3" rx="1"/><path d="M19 3c0 0 1 1 1 3s-1 3-1 3" strokeWidth="1.5"/><path d="M21 4.5 L23 2" strokeWidth="1.5"/></svg></span><span className="font-display text-xl">ResearchPilot</span></Link><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div></div>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const userId = user?.id ?? null;
    if (previousUserId.current !== undefined && previousUserId.current !== userId) queryClient.clear();
    previousUserId.current = userId;
  }), [addListener]);
  return null;
}

function LocalSignInPage({ onLogin }: { onLogin: (name: string, email: string) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Enter your name, email, and password to continue.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    onLogin(name.trim(), email.trim().toLowerCase());
  };
  return <main className="paper-grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-4 py-10 text-[hsl(var(--foreground))]"><div className="w-full max-w-[440px]"><div className="mb-8 flex items-center justify-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-md bg-[#e2bf5a] text-[#202838]"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="14" width="14" height="3" rx="1"/><rect x="5" y="10" width="14" height="3" rx="1"/><rect x="7" y="6" width="14" height="3" rx="1"/><path d="M19 3c0 0 1 1 1 3s-1 3-1 3" strokeWidth="1.5"/><path d="M21 4.5 L23 2" strokeWidth="1.5"/></svg></span><span className="font-display text-xl">ResearchPilot</span></div><div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm"><div className="mb-6"><div className="mb-2 font-mono-ui text-[10px] font-medium uppercase tracking-[.18em] text-[#92701d]">Evidence workspace</div><h1 className="font-display text-3xl">Welcome back.</h1><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Sign in to continue your research.</p></div><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-semibold">Name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="mt-2 h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm outline-none focus:border-[#bd9d43]" placeholder="Your name" /></label><label className="block text-sm font-semibold">Email address<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" className="mt-2 h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm outline-none focus:border-[#bd9d43]" placeholder="you@example.com" /></label><label className="block text-sm font-semibold">Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" className="mt-2 h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm outline-none focus:border-[#bd9d43]" placeholder="Enter your password" /></label>{error && <p role="alert" className="text-sm text-[#a64e45]">{error}</p>}<button type="submit" className="inline-flex h-10 w-full items-center justify-center rounded-md bg-[hsl(var(--primary))] text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:opacity-90">Sign in</button></form><p className="mt-5 text-center text-xs text-[hsl(var(--muted-foreground))]">New here? <Link href="/sign-up" className="font-semibold text-[#896c1c] hover:underline">Create an account</Link></p></div></div></main>;
}

function LocalSignUpPage({ onRegister }: { onRegister: (name: string, email: string) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Complete all fields to create your account.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    onRegister(name.trim(), email.trim().toLowerCase());
  };
  return <main className="paper-grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-4 py-10 text-[hsl(var(--foreground))]"><div className="w-full max-w-[440px]"><div className="mb-8 flex items-center justify-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-md bg-[#e2bf5a] text-[#202838]"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="14" width="14" height="3" rx="1"/><rect x="5" y="10" width="14" height="3" rx="1"/><rect x="7" y="6" width="14" height="3" rx="1"/><path d="M19 3c0 0 1 1 1 3s-1 3-1 3" strokeWidth="1.5"/><path d="M21 4.5 L23 2" strokeWidth="1.5"/></svg></span><span className="font-display text-xl">ResearchPilot</span></div><div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm"><div className="mb-6"><div className="mb-2 font-mono-ui text-[10px] font-medium uppercase tracking-[.18em] text-[#92701d]">Evidence workspace</div><h1 className="font-display text-3xl">Create your workspace.</h1><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Start organizing your research evidence.</p></div><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-semibold">Name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="mt-2 h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm outline-none focus:border-[#bd9d43]" placeholder="Your name" /></label><label className="block text-sm font-semibold">Email address<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" className="mt-2 h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm outline-none focus:border-[#bd9d43]" placeholder="you@example.com" /></label><label className="block text-sm font-semibold">Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" className="mt-2 h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm outline-none focus:border-[#bd9d43]" placeholder="At least 6 characters" /></label><label className="block text-sm font-semibold">Confirm password<input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" className="mt-2 h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm outline-none focus:border-[#bd9d43]" placeholder="Repeat your password" /></label>{error && <p role="alert" className="text-sm text-[#a64e45]">{error}</p>}<button type="submit" className="inline-flex h-10 w-full items-center justify-center rounded-md bg-[hsl(var(--primary))] text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:opacity-90">Create account</button></form><p className="mt-5 text-center text-xs text-[hsl(var(--muted-foreground))]">Already registered? <Link href="/sign-in" className="font-semibold text-[#896c1c] hover:underline">Sign in</Link></p></div></div></main>;
}

function LocalAuthRouter() {
  const [papers, setPapers] = useState(papersSeed);
  const [selectedId, setSelectedId] = useState('p1');
  const [location, setLocation] = useLocation();
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('researchpilot.localUser') || '');
  useEffect(() => { if (displayName && !localStorage.getItem('researchpilot.localEmail')) localStorage.setItem('researchpilot.localEmail', `${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@local.researchpilot`); }, [displayName]);
  const toggleFavorite = (id: string) => { const paper = papers.find((item) => item.id === id); if (!paper) return; const favorite = !paper.favorite; setPapers((items) => items.map((item) => item.id === id ? { ...item, favorite } : item)); void updatePaperInBackend(id, { favorite }).catch(() => undefined); };
  useEffect(() => { fetchBackendPapers().then(setPapers).catch(() => undefined); }, []);
  activeImportHandler = (file) => { void uploadPaperToBackend(file).then((paper) => setPapers((items) => [paper, ...items])).catch(() => setPapers((items) => [paperFromUpload(file), ...items])); };
  const login = (name: string, email: string) => { localStorage.setItem('researchpilot.localUser', name); localStorage.setItem('researchpilot.localEmail', email); setDisplayName(name); setLocation('/dashboard'); };
  const logout = () => { localStorage.removeItem('researchpilot.localUser'); localStorage.removeItem('researchpilot.localEmail'); setDisplayName(''); setLocation('/sign-in'); };
  if (!displayName) return <QueryClientProvider client={queryClient}>{location === '/sign-up' ? <LocalSignUpPage onRegister={login} /> : location === '/sign-in' ? <LocalSignInPage onLogin={login} /> : <Redirect to="/sign-in" />}</QueryClientProvider>;
  return <QueryClientProvider client={queryClient}><RouterView papers={papers} selectedId={selectedId} setSelectedId={setSelectedId} toggleFavorite={toggleFavorite} displayName={displayName} onSignOut={logout} /></QueryClientProvider>;
}

function AuthRouter() {
  const [, setLocation] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const [papers, setPapers] = useState(papersSeed);
  const [selectedId, setSelectedId] = useState('p1');
  const toggleFavorite = (id: string) => { const paper = papers.find((item) => item.id === id); if (!paper) return; const favorite = !paper.favorite; setPapers((items) => items.map((item) => item.id === id ? { ...item, favorite } : item)); void updatePaperInBackend(id, { favorite }).catch(() => undefined); };
  useEffect(() => { fetchBackendPapers().then(setPapers).catch(() => undefined); }, []);
  activeImportHandler = (file) => { void uploadPaperToBackend(file).then((paper) => setPapers((items) => [paper, ...items])).catch(() => setPapers((items) => [paperFromUpload(file), ...items])); };
  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Researcher';
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to continue your research' } }, signUp: { start: { title: 'Create your workspace', subtitle: 'Start building your evidence base' } } }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator />
      <Switch>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/">
          <Show when="signed-in"><Redirect to="/dashboard" /></Show>
          <Show when="signed-out"><HomeLanding /></Show>
        </Route>
        <Route path="/dashboard"><Show when="signed-in"><RouterView papers={papers} selectedId={selectedId} setSelectedId={setSelectedId} toggleFavorite={toggleFavorite} displayName={displayName} onSignOut={() => signOut({ redirectUrl: basePath || '/' })} /></Show><Show when="signed-out"><Redirect to="/" /></Show></Route>
        <Route path="/library"><Show when="signed-in"><RouterView papers={papers} selectedId={selectedId} setSelectedId={setSelectedId} toggleFavorite={toggleFavorite} displayName={displayName} onSignOut={() => signOut({ redirectUrl: basePath || '/' })} /></Show><Show when="signed-out"><Redirect to="/" /></Show></Route>
        <Route path="/reader"><Show when="signed-in"><RouterView papers={papers} selectedId={selectedId} setSelectedId={setSelectedId} toggleFavorite={toggleFavorite} displayName={displayName} onSignOut={() => signOut({ redirectUrl: basePath || '/' })} /></Show><Show when="signed-out"><Redirect to="/" /></Show></Route>
        <Route path="/intelligence"><Show when="signed-in"><RouterView papers={papers} selectedId={selectedId} setSelectedId={setSelectedId} toggleFavorite={toggleFavorite} displayName={displayName} onSignOut={() => signOut({ redirectUrl: basePath || '/' })} /></Show><Show when="signed-out"><Redirect to="/" /></Show></Route>
        <Route path="/citations"><Show when="signed-in"><RouterView papers={papers} selectedId={selectedId} setSelectedId={setSelectedId} toggleFavorite={toggleFavorite} displayName={displayName} onSignOut={() => signOut({ redirectUrl: basePath || '/' })} /></Show><Show when="signed-out"><Redirect to="/" /></Show></Route>
        <Route path="/chat"><Show when="signed-in"><RouterView papers={papers} selectedId={selectedId} setSelectedId={setSelectedId} toggleFavorite={toggleFavorite} displayName={displayName} onSignOut={() => signOut({ redirectUrl: basePath || '/' })} /></Show><Show when="signed-out"><Redirect to="/" /></Show></Route>
        <Route path="/settings"><Show when="signed-in"><RouterView papers={papers} selectedId={selectedId} setSelectedId={setSelectedId} toggleFavorite={toggleFavorite} displayName={displayName} onSignOut={() => signOut({ redirectUrl: basePath || '/' })} /></Show><Show when="signed-out"><Redirect to="/" /></Show></Route>
        <Route component={NotFound} />
      </Switch>
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  return <TooltipProvider><WouterRouter base={basePath}><ErrorBoundary resetKey={location.pathname}>{localDemoMode ? <LocalAuthRouter /> : <AuthRouter />}</ErrorBoundary></WouterRouter><Toaster /></TooltipProvider>;
}

export default App;
