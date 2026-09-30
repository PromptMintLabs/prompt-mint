import { useState, type FormEvent } from "react";
import { BookmarkPlus, FileText, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  getBuiltInModerationActionTemplates,
  type CustomModerationActionTemplate,
  type ModerationActionTemplate,
  type ModerationTemplateAction,
} from "@/lib/moderation/actionTemplates";

interface ActionTemplateLibraryProps {
  moderatorAddress: string;
  customTemplates: CustomModerationActionTemplate[];
  onSave: (template: Omit<CustomModerationActionTemplate, "id">) => boolean;
  onDelete: (templateId: string) => void;
}

const ACTIONS: ModerationTemplateAction[] = [
  "report_resolved",
  "report_dismissed",
  "prompt_takedown",
  "prompt_reinstated",
];

export function ActionTemplateLibrary({
  moderatorAddress,
  customTemplates,
  onSave,
  onDelete,
}: ActionTemplateLibraryProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [action, setAction] = useState<ModerationTemplateAction>("report_resolved");
  const [reason, setReason] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const builtInTemplates = getBuiltInModerationActionTemplates(t);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const saved = onSave({ name, action, reason });
    setSaveFailed(!saved);
    if (saved) {
      setName("");
      setReason("");
    }
  };

  const renderTemplate = (template: ModerationActionTemplate, removable: boolean) => (
    <li
      key={template.id}
      className="flex items-start justify-between gap-4 border-b border-white/10 py-4 last:border-0"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium text-slate-100">{template.name}</h3>
          <span className="rounded border border-white/10 px-2 py-0.5 text-xs text-slate-400">
            {t(`errors.moderation.action_templates.actions.${template.action}`)}
          </span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">{template.reason}</p>
      </div>
      {removable && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-slate-400 hover:text-rose-300"
          aria-label={t("errors.moderation.action_templates.delete_aria", { name: template.name })}
          title={t("errors.moderation.action_templates.delete")}
          onClick={() => onDelete(template.id)}
        >
          <Trash2 />
        </Button>
      )}
    </li>
  );

  if (!moderatorAddress) {
    return (
      <p className="py-10 text-center text-sm text-slate-400">
        {t("errors.moderation.action_templates.connect_required")}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-start gap-3">
        <FileText className="mt-1 h-5 w-5 shrink-0 text-emerald-400" />
        <div>
          <h2 className="text-xl font-bold text-white">
            {t("errors.moderation.action_templates.title")}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {t("errors.moderation.action_templates.description")}
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="grid gap-4 border-b border-white/10 pb-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-300">
            <span>{t("errors.moderation.action_templates.name_label")}</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("errors.moderation.action_templates.name_placeholder")}
              maxLength={80}
              required
              className="border-white/10 bg-white/5 text-white"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            <span>{t("errors.moderation.action_templates.action_label")}</span>
            <select
              value={action}
              onChange={(event) => setAction(event.target.value as ModerationTemplateAction)}
              className="h-10 w-full rounded-md border border-white/10 bg-slate-900 px-3 text-sm text-white"
            >
              {ACTIONS.map((item) => (
                <option key={item} value={item}>
                  {t(`errors.moderation.action_templates.actions.${item}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="space-y-2 text-sm text-slate-300">
          <span>{t("errors.moderation.action_templates.reason_label")}</span>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={1000}
            required
            className="border-white/10 bg-white/5 text-white"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" className="bg-emerald-500 font-semibold text-slate-950 hover:bg-emerald-400">
            <BookmarkPlus />
            {t("errors.moderation.action_templates.create")}
          </Button>
          {saveFailed && (
            <p role="alert" className="text-sm text-rose-300">
              {t("errors.moderation.action_templates.storage_error")}
            </p>
          )}
        </div>
      </form>

      <section aria-labelledby="custom-action-templates">
        <h3 id="custom-action-templates" className="mb-2 text-sm font-semibold text-white">
          {t("errors.moderation.action_templates.custom")}
        </h3>
        {customTemplates.length ? (
          <ul>{customTemplates.map((template) => renderTemplate({ ...template, source: "custom" }, true))}</ul>
        ) : (
          <p className="py-4 text-sm text-slate-500">
            {t("errors.moderation.action_templates.empty")}
          </p>
        )}
      </section>

      <section aria-labelledby="built-in-action-templates">
        <h3 id="built-in-action-templates" className="mb-2 text-sm font-semibold text-white">
          {t("errors.moderation.action_templates.built_in")}
        </h3>
        <ul>{builtInTemplates.map((template) => renderTemplate(template, false))}</ul>
      </section>
    </div>
  );
}