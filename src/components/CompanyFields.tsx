import {
  companyFields,
  companyFieldSpec,
  type CompanyData,
  type CompanyField,
} from '../../shared/site-content';
import { Field } from './PortalUI';

export function readCompanyFields(form: FormData, previous?: CompanyData) {
  const fields: Partial<CompanyData> = {};
  for (const field of companyFields) {
    const input = form.get(field);
    if (typeof input === 'string' && input.trim() !== (previous?.[field] ?? ''))
      fields[field] = input.trim();
  }
  return fields;
}

export function CompanyFields({
  values,
  onChange,
}: {
  values?: CompanyData;
  onChange?: (field: CompanyField, value: string) => void;
}) {
  return (
    <div className="form-grid">
      {companyFields.map((field) => {
        const { label, max } = companyFieldSpec[field];
        const props = onChange
          ? {
              value: values?.[field] ?? '',
              onChange: (
                event: React.ChangeEvent<
                  HTMLInputElement | HTMLTextAreaElement
                >,
              ) => onChange(field, event.target.value),
            }
          : { defaultValue: values?.[field] ?? '' };
        return (
          <Field key={field} label={label}>
            {field === 'companyAddress' ? (
              <textarea name={field} maxLength={max} rows={2} {...props} />
            ) : (
              <input name={field} maxLength={max} {...props} />
            )}
          </Field>
        );
      })}
    </div>
  );
}
