import { Button } from "@/components/ui/button";
import { creationReferences, referencePrompt, type CreationMode } from "@/lib/creation-references";

export default function CreationEmptyState({ mode, onPromptClick }: { mode: CreationMode; onPromptClick: (prompt: string) => void }) {
  return <div className="flex min-h-full flex-col items-center justify-center px-5 py-6 animate-fade-up">
    <h1 className="mb-6 text-center font-display text-xl font-semibold">{mode === "images" ? "Create an image" : "Create a video"}</h1>
    <div aria-label={`${mode} reference previews`} className="creation-reference-strip">
      {creationReferences.map((reference, index) => <Button key={reference.name} variant="ghost" className="creation-reference p-0" aria-label={`Create ${reference.name.toLowerCase()}`} title={reference.name} onClick={() => onPromptClick(referencePrompt(index, mode))}>
        <img src={reference.image} alt={reference.name} width={384} height={384} loading={index > 2 ? "lazy" : "eager"} className="size-full object-cover transition-transform hover:scale-105 motion-reduce:transition-none" />
      </Button>)}
    </div>
  </div>;
}