import { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const subscriptionSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type SubscriptionFormValues = z.infer<typeof subscriptionSchema>;

export const EmailSubscription = ({ organizationSlug }: { organizationSlug: string }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionSchema),
  });

  const onSubmit: SubmitHandler<SubscriptionFormValues> = async (data) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/public_proxy/${organizationSlug}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorJson = JSON.parse(errorText);
          // Use the 'detail' field from FastAPI's HTTPExceptions or a generic message
          errorMessage = errorJson.detail || 'An unknown error occurred.';
        } catch (e) {
          // The response was not valid JSON, likely an HTML error page
          console.error('Received non-JSON error response from server:', errorText);
          errorMessage = `The server returned an unexpected response (Status: ${response.status}). Please try again later.`;
        }
        throw new Error(errorMessage);
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-green-50 p-4 rounded-lg">
        <p className="text-green-700">You have been subscribed to status updates!</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-semibold mb-4">Subscribe to Status Updates</h2>
      <p className="text-gray-600 mb-6">Get email notifications about service status changes.</p>

      {error && (
        <div className="bg-red-50 p-4 rounded-lg mb-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Input
            type="email"
            placeholder="your.email@example.com"
            {...register('email')}
            disabled={isLoading}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Subscribing...' : 'Subscribe'}
        </Button>
      </form>
    </div>
  );
}
