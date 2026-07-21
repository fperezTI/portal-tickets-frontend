import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listTasks, updateTask } from '../../api/tasks';
import { searchSystemUsers } from '../../api/d365';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { cn, fmtHours } from '@/lib/utils';
import { toast } from 'sonner';
import DataTable from '../../components/DataTable';
import PolicyCombobox from '../../components/PolicyCombobox';

// ─── Filtro multi-selección de usuarios ───────────────────────────────────────
const UserMultiSelect = ({ selected, onChange }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) { setOptions([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        setOptions(await searchSystemUsers(query));
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const toggle = (user) => {
    const exists = selected.some((u) => u.id === user.id);
    onChange(exists ? selected.filter((u) => u.id !== user.id) : [...selected, user]);
  };

  const remove = (id) => onChange(selected.filter((u) => u.id !== id));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" size="sm" className="h-8 text-sm justify-between w-56">
            <span className="text-muted-foreground truncate">
              {selected.length ? t('tasksPage.usersSelected', { count: selected.length }) : t('tasksPage.createdByPlaceholder')}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-40 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-80" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={t('tasksPage.searchUser')} value={query} onValueChange={setQuery} />
            <CommandList>
              {loading && (
                <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t('combobox.searching')}
                </div>
              )}
              {!loading && query.length < 2 && (
                <CommandEmpty>{t('combobox.typeToSearch')}</CommandEmpty>
              )}
              {!loading && query.length >= 2 && options.length === 0 && (
                <CommandEmpty>{t('combobox.noResultsFor', { query })}</CommandEmpty>
              )}
              {!loading && options.length > 0 && (
                <CommandGroup>
                  {options.map((opt) => {
                    const isSelected = selected.some((u) => u.id === opt.id);
                    return (
                      <CommandItem key={opt.id} value={opt.id} onSelect={() => toggle(opt)} className="cursor-pointer">
                        <Check className={cn('mr-2 h-4 w-4 shrink-0', isSelected ? 'opacity-100 text-primary' : 'opacity-0')} />
                        <span className="truncate text-sm">{opt.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.map((u) => (
        <span key={u.id} className="inline-flex items-center gap-1 text-xs font-medium bg-muted rounded-full pl-2.5 pr-1 py-1">
          {u.name}
          <button type="button" onClick={() => remove(u.id)} className="rounded-full hover:bg-background/60 p-0.5">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
};

// ─── Utilidades de fecha ───────────────────────────────────────────────────────
const toDatetimeLocal = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromDatetimeLocal = (local) => (local ? new Date(local).toISOString() : null);

// ─── Celdas editables (cada una gestiona su propio estado + auto-guardado) ────
const DueDateCell = ({ task, onSaved }) => {
  const { t } = useTranslation();
  const [dueDateLocal, setDueDateLocal] = useState(toDatetimeLocal(task.dueDate));
  const [saving, setSaving] = useState(false);

  const handleBlur = async () => {
    const nextIso = fromDatetimeLocal(dueDateLocal);
    if (nextIso === (task.dueDate || null)) return;
    setSaving(true);
    try {
      const updated = await updateTask(task.id, { dueDate: nextIso });
      onSaved(task.id, updated);
    } catch (err) {
      toast.error(err.response?.data?.error || t('tasksPage.saveError'));
      setDueDateLocal(toDatetimeLocal(task.dueDate));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <Input
        type="datetime-local"
        value={dueDateLocal}
        onChange={(e) => setDueDateLocal(e.target.value)}
        onBlur={handleBlur}
        className="h-8 text-xs w-[170px]"
      />
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
    </div>
  );
};

const HoursCell = ({ task, field, onSaved }) => {
  const { t } = useTranslation();
  const [value, setValue] = useState(task[field] ?? '');
  const [saving, setSaving] = useState(false);

  const handleBlur = async () => {
    const num = value === '' ? null : parseFloat(value);
    if (num === (task[field] ?? null)) return;
    setSaving(true);
    try {
      const updated = await updateTask(task.id, { [field]: num });
      onSaved(task.id, updated);
    } catch (err) {
      toast.error(err.response?.data?.error || t('tasksPage.saveError'));
      setValue(task[field] ?? '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <Input
        type="number"
        step="0.25"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        className="h-8 text-xs w-20"
      />
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
    </div>
  );
};

const AuditCell = ({ task, onSaved }) => {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(!!task.isAudit);
  const [saving, setSaving] = useState(false);

  const handleChange = async (next) => {
    setChecked(next);
    setSaving(true);
    try {
      const updated = await updateTask(task.id, { isAudit: next });
      onSaved(task.id, updated);
    } catch (err) {
      toast.error(err.response?.data?.error || t('tasksPage.saveError'));
      setChecked(task.isAudit);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <Switch checked={checked} onCheckedChange={handleChange} />
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
    </div>
  );
};

const PolicyCell = ({ task, onSaved }) => {
  const { t } = useTranslation();
  const [policyId, setPolicyId] = useState(task.policyId || '');
  const [policyName, setPolicyName] = useState(task.policyName || '');
  const [saving, setSaving] = useState(false);

  const handleChange = async (nextId, nextName) => {
    setSaving(true);
    try {
      const updated = await updateTask(task.id, { policyId: nextId || null });
      setPolicyId(nextId);
      setPolicyName(nextName);
      onSaved(task.id, updated);
    } catch (err) {
      toast.error(err.response?.data?.error || t('tasksPage.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5 w-44" onClick={(e) => e.stopPropagation()}>
      <PolicyCombobox
        value={policyId}
        label={policyName}
        onChange={handleChange}
        disabled={saving}
        placeholder={t('tasksPage.inheritedFromTicket')}
      />
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
    </div>
  );
};

// ─── Tabla ─────────────────────────────────────────────────────────────────────
const TasksTable = ({ tasks, onSaved, onNavigate }) => {
  const { t } = useTranslation();
  const columns = [
    { key: 'ticket', label: t('table.ticket'), width: 200, filterType: 'text',
      accessor: (tk) => tk.regardingName,
      render: (tk) => (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(tk.regardingId); }}
          className="text-sm font-medium text-primary hover:underline text-left line-clamp-2"
          title={tk.regardingName}
        >
          {tk.regardingName || '—'}
        </button>
      ) },
    { key: 'poliza', label: t('policies.policy'), width: 190, filterType: 'text',
      accessor: (tk) => tk.policyName,
      render: (tk) => <PolicyCell task={tk} onSaved={onSaved} /> },
    { key: 'asunto', label: t('tasksPage.subject'), width: 240, filterType: 'text',
      accessor: (tk) => tk.subject,
      render: (tk) => <span className="text-sm line-clamp-2">{tk.subject || '—'}</span> },
    { key: 'creadopor', label: t('tasksPage.createdBy'), width: 150, filterType: 'text',
      accessor: (tk) => tk.createdByName,
      render: (tk) => <span className="text-sm text-muted-foreground whitespace-nowrap">{tk.createdByName || '—'}</span> },
    { key: 'fechalimite', label: t('tasksPage.dueDate'), width: 190, filterType: 'none',
      accessor: (tk) => tk.dueDate ? new Date(tk.dueDate) : null,
      render: (tk) => <DueDateCell task={tk} onSaved={onSaved} /> },
    { key: 'duracion', label: t('tasksPage.duration'), width: 100, filterType: 'none',
      accessor: (tk) => tk.durationHours,
      render: (tk) => <span className="text-sm text-muted-foreground whitespace-nowrap">{tk.durationHours != null ? `${fmtHours(tk.durationHours)} h` : '—'}</span> },
    { key: 'facturables', label: t('tasksPage.billableHours'), width: 140, filterType: 'none',
      accessor: (tk) => tk.billableHours,
      render: (tk) => <HoursCell task={tk} field="billableHours" onSaved={onSaved} /> },
    { key: 'reworking', label: t('tasksPage.reworking'), width: 120, filterType: 'none',
      accessor: (tk) => tk.reworkingHours,
      render: (tk) => <HoursCell task={tk} field="reworkingHours" onSaved={onSaved} /> },
    { key: 'auditoria', label: t('tasksPage.isAudit'), width: 110, filterType: 'select',
      accessor: (tk) => (tk.isAudit ? t('common.yes') : t('common.no')),
      render: (tk) => <AuditCell task={tk} onSaved={onSaved} /> },
  ];

  return (
    <DataTable
      columns={columns}
      data={tasks}
      getRowKey={(t) => t.id}
      maxHeight="calc(100vh-320px)"
    />
  );
};

// ─── Página ────────────────────────────────────────────────────────────────────

const TasksPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [dueDateFrom, setDueDateFrom] = useState('');
  const [dueDateTo, setDueDateTo] = useState('');
  const [subject, setSubject] = useState('');
  const [subjectInput, setSubjectInput] = useState('');
  const [tasks, setTasks] = useState([]);
  const [nextLink, setNextLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTasks = useCallback(async (link = null) => {
    try {
      setLoading(true);
      setError('');
      const params = link
        ? { nextLink: link }
        : {
            ...(selectedUsers.length ? { createdBy: selectedUsers.map((u) => u.id).join(',') } : {}),
            ...(dueDateFrom ? { dueDateFrom: new Date(dueDateFrom).toISOString() } : {}),
            ...(dueDateTo   ? { dueDateTo:   new Date(dueDateTo + 'T23:59:59').toISOString() } : {}),
            ...(subject     ? { subject } : {}),
          };
      const result = await listTasks(params);
      setTasks((prev) => (link ? [...prev, ...result.data] : result.data));
      setNextLink(result.nextLink);
    } catch (err) {
      setError(err.response?.data?.error || t('tasksPage.loadError'));
    } finally {
      setLoading(false);
    }
  }, [selectedUsers, dueDateFrom, dueDateTo, subject, t]);

  useEffect(() => {
    setTasks([]);
    setNextLink(null);
    fetchTasks();
  }, [selectedUsers, dueDateFrom, dueDateTo, subject]);

  const handleSaved = (id, updated) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
  };

  const hasActiveFilters = selectedUsers.length > 0 || dueDateFrom || dueDateTo || subject;
  const clearFilters = () => {
    setSelectedUsers([]);
    setDueDateFrom('');
    setDueDateTo('');
    setSubject('');
    setSubjectInput('');
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('nav.tasks')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('tasksPage.subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <form
          onSubmit={(e) => { e.preventDefault(); setSubject(subjectInput.trim()); }}
          className="flex gap-1.5"
        >
          <Input
            placeholder={t('tasksPage.searchBySubject')}
            value={subjectInput}
            onChange={(e) => setSubjectInput(e.target.value)}
            className="w-56 h-8 text-sm"
          />
          <Button type="submit" variant="secondary" size="sm" className="h-8 px-3">
            <Search className="h-3.5 w-3.5" />
          </Button>
        </form>

        <UserMultiSelect selected={selectedUsers} onChange={setSelectedUsers} />

        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground">{t('tasksPage.from')}</Label>
          <Input type="date" value={dueDateFrom} onChange={(e) => setDueDateFrom(e.target.value)} className="h-8 text-sm w-36" />
        </div>
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground">{t('tasksPage.to')}</Label>
          <Input type="date" value={dueDateTo} onChange={(e) => setDueDateTo(e.target.value)} className="h-8 text-sm w-36" />
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
            <X className="mr-1 h-3.5 w-3.5" /> {t('common.clear')}
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button variant="ghost" size="sm" onClick={() => fetchTasks()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium text-muted-foreground">
            {loading && tasks.length === 0 ? t('common.loadingEllipsis') : t('tasksPage.taskCount', { count: tasks.length, plus: nextLink ? '+' : '' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && tasks.length === 0 ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">
              {t('tasksPage.noResults')}
            </div>
          ) : (
            <TasksTable tasks={tasks} onSaved={handleSaved} onNavigate={(id) => navigate(`/cases/${id}`)} />
          )}

          {nextLink && !loading && (
            <div className="py-1 px-4 text-center border-t">
              <Button variant="ghost" size="sm" className="h-7 text-xs w-full" onClick={() => fetchTasks(nextLink)}>
                {t('tasksPage.loadMore')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TasksPage;
