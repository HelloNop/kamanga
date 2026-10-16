'use client';

import { createFormHook } from '@tanstack/react-form';
import { fieldContext, formContext } from '@/lib/form-context';
import { TextField } from '@/components/forms/fields/text-field';
import { TextareaField } from '@/components/forms/fields/textarea-field';
import { SelectField } from '@/components/forms/fields/select-field';
import { CheckboxField } from '@/components/forms/fields/checkbox-field';
import { SwitchField } from '@/components/forms/fields/switch-field';
import { RadioGroupField } from '@/components/forms/fields/radio-group-field';
import { ComboboxField } from '@/components/forms/fields/combobox-field';
import { DatePickerField, DateRangeField } from '@/components/forms/fields/date-picker-field';
import { OtpField } from '@/components/forms/fields/otp-field';
import { FileUploadField } from '@/components/forms/fields/file-upload-field';
import { CheckboxGroupField } from '@/components/forms/fields/checkbox-group-field';
import { TagsField } from '@/components/forms/fields/tags-field';
import { ToggleGroupField } from '@/components/forms/fields/toggle-group-field';
import { SubmitButton } from '@/components/forms/submit-button';

// Hook formulir untuk seluruh aplikasi: komponen isian didaftarkan sekali, dipakai lewat
// form.AppField. Isian khusus memakai form.Field mentah. Panduan: docs/forms.md.
export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    TextareaField,
    SelectField,
    CheckboxField,
    SwitchField,
    RadioGroupField,
    ComboboxField,
    DatePickerField,
    DateRangeField,
    OtpField,
    FileUploadField,
    CheckboxGroupField,
    TagsField,
    ToggleGroupField
  },
  formComponents: {
    SubmitButton
  }
});
