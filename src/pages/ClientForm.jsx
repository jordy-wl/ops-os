import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';

export default function ClientForm() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formInstance, setFormInstance] = useState(null);
  const [formTemplate, setFormTemplate] = useState(null);
  const [formData, setFormData] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [thankYouMessage, setThankYouMessage] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
      setError('Invalid form link');
      setLoading(false);
      return;
    }

    // Fetch form instance and template
    const loadForm = async () => {
      try {
        const instances = await base44.entities.FormInstance.filter({ unique_url_token: token });
        const instance = instances[0];

        if (!instance) {
          setError('Form not found');
          setLoading(false);
          return;
        }

        if (instance.status === 'completed') {
          setError('This form has already been submitted');
          setLoading(false);
          return;
        }

        if (instance.status === 'expired') {
          setError('This form has expired');
          setLoading(false);
          return;
        }

        const templates = await base44.entities.FormTemplate.filter({ id: instance.form_template_id });
        const template = templates[0];

        if (!template) {
          setError('Form template not found');
          setLoading(false);
          return;
        }

        setFormInstance(instance);
        setFormTemplate(template);

        // Mark as opened
        if (instance.status === 'sent') {
          await base44.entities.FormInstance.update(instance.id, {
            status: 'opened',
            opened_at: new Date().toISOString()
          });
        }

        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    loadForm();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await base44.functions.invoke('submitClientFormData', {
        unique_url_token: formInstance.unique_url_token,
        submitted_data: formData
      });

      setThankYouMessage(response.data.message);
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field) => {
    const value = formData[field.field_key] || '';
    const commonProps = {
      value,
      onChange: (e) => setFormData({ ...formData, [field.field_key]: e.target.value }),
      placeholder: field.placeholder,
      required: field.is_required,
      className: "bg-[#1A1B1E] border-[#2C2E33]"
    };

    switch (field.field_type) {
      case 'textarea':
        return <Textarea {...commonProps} rows={4} />;
      case 'email':
        return <Input {...commonProps} type="email" />;
      case 'number':
        return <Input {...commonProps} type="number" />;
      case 'phone':
        return <Input {...commonProps} type="tel" />;
      case 'date':
        return <Input {...commonProps} type="date" />;
      case 'checkbox':
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => setFormData({ ...formData, [field.field_key]: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">{field.field_label}</span>
          </label>
        );
      default:
        return <Input {...commonProps} type="text" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#00E5FF] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-6">
        <div className="glass rounded-2xl p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Unable to Load Form</h2>
          <p className="text-[#A0AEC0]">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-6">
        <div className="glass rounded-2xl p-8 max-w-md text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Thank You!</h2>
          <p className="text-[#A0AEC0]">{thankYouMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="glass rounded-2xl p-8">
          <h1 className="text-2xl font-bold mb-2">{formTemplate.name}</h1>
          {formTemplate.description && (
            <p className="text-[#A0AEC0] mb-6">{formTemplate.description}</p>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {formTemplate.form_schema?.map((field, idx) => (
              <div key={idx}>
                <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
                  {field.field_label}
                  {field.is_required && <span className="text-red-400 ml-1">*</span>}
                </label>
                {renderField(field)}
              </div>
            ))}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}