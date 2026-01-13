import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ThumbsUp, ThumbsDown, Star } from 'lucide-react';
import { toast } from 'sonner';

export default function AISuggestionFeedback({ context, auditLogId, onFeedbackSubmitted }) {
  const [rating, setRating] = useState(0);
  const [wasHelpful, setWasHelpful] = useState(null);
  const [wasImplemented, setWasImplemented] = useState(null);
  const [comment, setComment] = useState('');

  const submitFeedbackMutation = useMutation({
    mutationFn: async () => {
      // Find the most recent audit log for this context if not provided
      let logId = auditLogId;
      
      if (!logId) {
        // In a real implementation, you'd query for the audit log
        // For now, we'll create a feedback entry
        const response = await base44.functions.invoke('submitAIFeedback', {
          context,
          feedback_rating: rating,
          feedback_comment: comment,
          was_helpful: wasHelpful,
          was_implemented: wasImplemented,
        });
        return response.data;
      }

      const response = await base44.functions.invoke('submitAIFeedback', {
        audit_log_id: logId,
        feedback_rating: rating,
        feedback_comment: comment,
        was_helpful: wasHelpful,
        was_implemented: wasImplemented,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Thank you for your feedback!');
      setRating(0);
      setWasHelpful(null);
      setWasImplemented(null);
      setComment('');
      if (onFeedbackSubmitted) onFeedbackSubmitted();
    },
    onError: () => {
      toast.error('Failed to submit feedback');
    }
  });

  return (
    <div className="neumorphic-pressed rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-medium">Rate this AI suggestion</h4>

      {/* Star Rating */}
      <div>
        <label className="text-xs text-[#A0AEC0] block mb-2">Overall Quality</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className={`p-1 transition-colors ${
                star <= rating ? 'text-[#00E5FF]' : 'text-[#4A5568] hover:text-[#A0AEC0]'
              }`}
            >
              <Star className="w-5 h-5" fill={star <= rating ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
      </div>

      {/* Was Helpful */}
      <div>
        <label className="text-xs text-[#A0AEC0] block mb-2">Was this helpful?</label>
        <div className="flex gap-2">
          <button
            onClick={() => setWasHelpful(true)}
            className={`flex-1 py-2 px-3 rounded-lg border transition-colors ${
              wasHelpful === true
                ? 'bg-green-500/20 border-green-500/30 text-green-400'
                : 'border-[#2C2E33] hover:bg-[#2C2E33]'
            }`}
          >
            <ThumbsUp className="w-4 h-4 mx-auto" />
          </button>
          <button
            onClick={() => setWasHelpful(false)}
            className={`flex-1 py-2 px-3 rounded-lg border transition-colors ${
              wasHelpful === false
                ? 'bg-red-500/20 border-red-500/30 text-red-400'
                : 'border-[#2C2E33] hover:bg-[#2C2E33]'
            }`}
          >
            <ThumbsDown className="w-4 h-4 mx-auto" />
          </button>
        </div>
      </div>

      {/* Was Implemented */}
      <div>
        <label className="text-xs text-[#A0AEC0] block mb-2">Did you implement this suggestion?</label>
        <div className="flex gap-2">
          <button
            onClick={() => setWasImplemented(true)}
            className={`flex-1 py-2 px-3 rounded-lg border text-sm transition-colors ${
              wasImplemented === true
                ? 'bg-[#00E5FF]/20 border-[#00E5FF]/30 text-[#00E5FF]'
                : 'border-[#2C2E33] hover:bg-[#2C2E33]'
            }`}
          >
            Yes
          </button>
          <button
            onClick={() => setWasImplemented(false)}
            className={`flex-1 py-2 px-3 rounded-lg border text-sm transition-colors ${
              wasImplemented === false
                ? 'bg-[#4A5568]/20 border-[#4A5568]/30 text-[#A0AEC0]'
                : 'border-[#2C2E33] hover:bg-[#2C2E33]'
            }`}
          >
            No
          </button>
        </div>
      </div>

      {/* Comment */}
      <div>
        <label className="text-xs text-[#A0AEC0] block mb-2">Additional Feedback (Optional)</label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us more about your experience..."
          className="bg-[#1A1B1E] border-[#2C2E33] text-sm"
          rows={3}
        />
      </div>

      {/* Submit */}
      <Button
        onClick={() => submitFeedbackMutation.mutate()}
        disabled={submitFeedbackMutation.isPending || rating === 0}
        className="w-full bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
        size="sm"
      >
        {submitFeedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
      </Button>
    </div>
  );
}