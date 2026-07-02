import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createCase } from '../api/cases';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const schema = z.object({
  title:       z.string().min(1, 'El título es requerido'),
  description: z.string().min(1, 'La descripción es requerida'),
  priority:    z.string().optional(),
});

const NewCasePage = () => {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { priority: '2' },
  });

  const onSubmit = async ({ title, description, priority }) => {
    setError('');
    try {
      await createCase({
        title,
        description,
        priority: priority ? parseInt(priority) : undefined,
      });
      toast.success('Ticket creado correctamente');
      navigate('/cases');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear el ticket');
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/cases')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold">Nuevo Ticket</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalles de la solicitud</CardTitle>
          <CardDescription>
            Completa la información para abrir un ticket de soporte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                placeholder="Resumen breve del problema"
                {...register('title')}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Descripción *</Label>
              <Textarea
                id="description"
                placeholder="Describe el problema con el mayor detalle posible..."
                rows={6}
                {...register('description')}
              />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select
                defaultValue="2"
                onValueChange={(val) => setValue('priority', val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Alta</SelectItem>
                  <SelectItem value="2">Normal</SelectItem>
                  <SelectItem value="3">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-1">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Enviando...' : 'Crear Ticket'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/cases')}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewCasePage;
