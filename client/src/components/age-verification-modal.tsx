import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { APP_NAME } from "@/branding/brand";

// Generate arrays for date selection
const generateDays = () => {
  return Array.from({ length: 31 }, (_, i) => ({
    value: (i + 1).toString(),
    label: (i + 1).toString().padStart(2, '0')
  }));
};

const generateMonths = () => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months.map((month, i) => ({
    value: (i + 1).toString(),
    label: month
  }));
};

const generateYears = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = currentYear - 13; year >= currentYear - 120; year--) {
    years.push({
      value: year.toString(),
      label: year.toString()
    });
  }
  return years;
};

// Create dynamic age verification schema based on region
const createAgeVerificationSchema = (selectedRegion: string) => {
  const region = REGIONS.find(r => r.value === selectedRegion);
  const requiredAge = region ? region.minAge : 18;
  
  return z.object({
    day: z.string({
      required_error: "Please select a day.",
    }).min(1, "Please select a day."),
    month: z.string({
      required_error: "Please select a month.",
    }).min(1, "Please select a month."),
    year: z.string({
      required_error: "Please select a year.",
    }).min(1, "Please select a year."),
    region: z.string({
      required_error: "Please select your region.",
    }),
  }).refine((data) => {
    // Validate date exists (e.g., no Feb 31)
    const day = parseInt(data.day);
    const month = parseInt(data.month);
    const year = parseInt(data.year);
    
    const date = new Date(year, month - 1, day);
    return date.getDate() === day && date.getMonth() === (month - 1) && date.getFullYear() === year;
  }, {
    message: "Please enter a valid date.",
    path: ["day"],
  }).refine((data) => {
    // Validate age based on selected region's minimum age requirement
    const selectedRegion = REGIONS.find(r => r.value === data.region);
    const minAge = selectedRegion ? selectedRegion.minAge : 18;
    
    const today = new Date();
    const birthDate = new Date(parseInt(data.year), parseInt(data.month) - 1, parseInt(data.day));
    
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return age - 1 >= minAge;
    }
    return age >= minAge;
  }, {
    message: `You must be at least ${requiredAge} years old to use this platform in your region.`,
    path: ["day"],
  });
};

type AgeVerificationForm = z.infer<ReturnType<typeof createAgeVerificationSchema>>;

interface AgeVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
}

// Regional age requirements and labels
const REGIONS = [
  { value: "US", label: "United States", minAge: 18 },
  { value: "GB", label: "United Kingdom", minAge: 18 },
  { value: "CA", label: "Canada", minAge: 18 },
  { value: "AU", label: "Australia", minAge: 18 },
  { value: "DE", label: "Germany", minAge: 18 },
  { value: "FR", label: "France", minAge: 18 },
  { value: "ES", label: "Spain", minAge: 18 },
  { value: "IT", label: "Italy", minAge: 18 },
  { value: "NL", label: "Netherlands", minAge: 18 },
  { value: "SE", label: "Sweden", minAge: 18 },
  { value: "NO", label: "Norway", minAge: 18 },
  { value: "DK", label: "Denmark", minAge: 18 },
  { value: "FI", label: "Finland", minAge: 18 },
  { value: "JP", label: "Japan", minAge: 18 },
  { value: "KR", label: "South Korea", minAge: 19 },
  { value: "OTHER", label: "Other", minAge: 18 },
];

export function AgeVerificationModal({ isOpen, onClose, onVerified }: AgeVerificationModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentRegionValue, setCurrentRegionValue] = useState("US");

  const form = useForm<AgeVerificationForm>({
    resolver: zodResolver(createAgeVerificationSchema(currentRegionValue)),
    defaultValues: {
      region: "US",
      day: "",
      month: "",
      year: "",
    },
  });

  // Update schema when region changes
  const watchedRegion = form.watch("region");
  if (watchedRegion !== currentRegionValue) {
    setCurrentRegionValue(watchedRegion);
    // Re-create form with new schema - trigger re-validation
    form.clearErrors();
  }

  const verifyAgeMutation = useMutation({
    mutationFn: async (data: AgeVerificationForm) => {
      // Convert day/month/year to ISO date string for server
      const birthDate = new Date(parseInt(data.year), parseInt(data.month) - 1, parseInt(data.day));
      const res = await apiRequest("POST", "/api/safety/verify-age", {
        dateOfBirth: birthDate.toISOString(),
        region: data.region,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Age verified successfully",
        description: `Welcome to ${APP_NAME}! You can now access all features.`,
      });
      onVerified();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Age verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: AgeVerificationForm) => {
    setIsSubmitting(true);
    try {
      await verifyAgeMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedRegionData = REGIONS.find(r => r.value === form.watch("region"));
  
  // Generate options
  const dayOptions = generateDays();
  const monthOptions = generateMonths();
  const yearOptions = generateYears();

  return (
    <Dialog open={isOpen} onOpenChange={() => !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-[425px]" data-testid="age-verification-modal">
        <DialogHeader>
          <DialogTitle>Age Verification Required</DialogTitle>
          <DialogDescription>
            {APP_NAME} is an adult platform designed for users 18 and older. 
            Please verify your age to continue using our services.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Region/Country</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    data-testid="select-region"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your region" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REGIONS.map((region) => (
                        <SelectItem 
                          key={region.value} 
                          value={region.value}
                          data-testid={`region-${region.value}`}
                        >
                          {region.label}
                          {region.minAge > 18 && ` (${region.minAge}+ required)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {selectedRegionData && selectedRegionData.minAge > 18 && (
                      <span className="text-orange-600 dark:text-orange-400">
                        Minimum age for {selectedRegionData.label}: {selectedRegionData.minAge} years
                      </span>
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date of Birth - Three Select Dropdowns */}
            <div className="space-y-4">
              <FormLabel>Date of Birth</FormLabel>
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="month"
                  render={({ field }) => (
                    <FormItem>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        data-testid="select-birth-month"
                      >
                        <FormControl>
                          <SelectTrigger aria-label="Birth month">
                            <SelectValue placeholder="Month" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {monthOptions.map((month) => (
                            <SelectItem 
                              key={month.value} 
                              value={month.value}
                              data-testid={`month-${month.value}`}
                            >
                              {month.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="day"
                  render={({ field }) => (
                    <FormItem>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        data-testid="select-birth-day"
                      >
                        <FormControl>
                          <SelectTrigger aria-label="Birth day">
                            <SelectValue placeholder="Day" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {dayOptions.map((day) => (
                            <SelectItem 
                              key={day.value} 
                              value={day.value}
                              data-testid={`day-${day.value}`}
                            >
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        data-testid="select-birth-year"
                      >
                        <FormControl>
                          <SelectTrigger aria-label="Birth year">
                            <SelectValue placeholder="Year" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {yearOptions.map((year) => (
                            <SelectItem 
                              key={year.value} 
                              value={year.value}
                              data-testid={`year-${year.value}`}
                            >
                              {year.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormDescription>
                Your date of birth is used for age verification only and is stored securely.
                {selectedRegionData && (
                  <span className="block mt-1">
                    Minimum age requirement: {selectedRegionData.minAge} years
                  </span>
                )}
              </FormDescription>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Privacy Notice:</strong> Your date of birth is encrypted and used solely 
                for age verification. We comply with data protection regulations and do not 
                share your personal information with third parties.
              </p>
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={isSubmitting}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                data-testid="button-verify-age"
              >
                {isSubmitting ? "Verifying..." : "Verify Age"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}