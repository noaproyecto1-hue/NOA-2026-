import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function EntityForm({
  fields,
  defaultValues = {},
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  cancelLabel = "Cancelar",
  onCancel
}) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues
  });

  const allValues = watch();

  const renderField = (field) => {
    const value = watch(field.name);

    switch (field.type) {
      case 'dynamicSelect': {
        const dynamicOptions = field.getOptions ? field.getOptions(allValues) : [];
        return (
          <Select
            value={value || ''}
            onValueChange={(val) => setValue(field.name, val)}
          >
            <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500">
              <SelectValue placeholder={field.placeholder || `Seleccionar ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {dynamicOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      case 'select':
        return (
          <Select
            value={value || ''}
            onValueChange={(val) => setValue(field.name, val)}
          >
            <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500">
              <SelectValue placeholder={field.placeholder || `Seleccionar ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'textarea':
        return (
          <Textarea
            {...register(field.name, { required: field.required })}
            placeholder={field.placeholder}
            className="rounded-xl border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
            rows={field.rows || 3}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            step={field.step || "any"}
            {...register(field.name, { 
              required: field.required,
              valueAsNumber: true
            })}
            placeholder={field.placeholder}
            className="h-11 rounded-xl border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            {...register(field.name, { required: field.required })}
            className="h-11 rounded-xl border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
          />
        );

      case 'switch':
        return (
          <div className="flex items-center gap-3">
            <Switch
              checked={value || false}
              onCheckedChange={(checked) => setValue(field.name, checked)}
              className="data-[state=checked]:bg-green-600"
            />
            <span className="text-sm text-gray-600">{field.switchLabel}</span>
          </div>
        );

      default:
        return (
          <Input
            type={field.type || 'text'}
            {...register(field.name, { required: field.required })}
            placeholder={field.placeholder}
            className="h-11 rounded-xl border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
          />
        );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {fields.map((field, index) => {
        // Verificar si el campo debe mostrarse (conditionalDisplay)
        if (field.conditionalDisplay && !field.conditionalDisplay(allValues)) {
          return null;
        }
        
        return (
          <motion.div 
            key={field.name} 
            className="space-y-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
          >
            <Label htmlFor={field.name} className="text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {renderField(field)}
            {errors[field.name] && (
              <p className="text-sm text-red-500">Este campo es requerido</p>
            )}
          </motion.div>
        );
      })}

      <div className="flex gap-3 pt-5 border-t border-gray-100">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1 rounded-xl hover:bg-gray-50">
            {cancelLabel}
          </Button>
        )}
        <Button 
          type="submit" 
          disabled={isLoading} 
          className="flex-1 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-200 transition-all duration-300"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              {submitLabel}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}