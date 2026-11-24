import { useState } from 'react';
import type { CreateExampleInput, Example } from '@/api/examples';
import { TextAreaField, TextField } from '@/components/fields';
import { FormDialog } from '@/components/FormDialog';
import { useI18n } from '@/i18n/i18n-context';
import { RULES, validateText } from '@/lib/validation';

// Create or edit an example. The fields are checked here with the rules of the API, so the messages are in the language
// of the user; the API checks them again.
export function ExampleFormDialog({ example, pending, error, onSubmit, onClose }: {
  example?  : Example;
  pending   : boolean;
  error     : string | null;
  onSubmit  : (values: CreateExampleInput) => void;
  onClose   : () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(example?.name ?? '');
  const [description, setDescription] = useState(example?.description ?? '');
  const [errors, setErrors] = useState<{ name: string | null; description: string | null }>({ name: null, description: null });

  function handleSubmit() {
    const next = {
      name        : validateText(name, RULES.exampleName, t),
      description : validateText(description, RULES.exampleDescription, t),
    };
    setErrors(next);
    if (next.name || next.description) return;

    // An empty description is sent as null, which clears it on an edit.
    onSubmit({ name: name.trim(), description: description.trim() === '' ? null : description.trim() });
  }

  return (
    <FormDialog title={example ? t('examples.formEdit') : t('examples.formNew')} pending={pending} error={error} onClose={onClose} onSubmit={handleSubmit}>
      <TextField
        label={t('common.name')}
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={errors.name}
        hint={t('examples.nameHint')}
        autoComplete="off"
        autoFocus
      />
      <TextAreaField
        label={t('common.description')}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        error={errors.description}
        autoComplete="off"
      />
    </FormDialog>
  );
}
