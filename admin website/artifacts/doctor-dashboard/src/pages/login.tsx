import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDoctorLogin, useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Stethoscope, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: user, isLoading: isCheckingAuth } = useGetMe({
    query: { queryKey: ["/api/auth/me"], retry: false }
  });

  useEffect(() => {
    if (user) {
      if (user.mustChangePassword) {
        setLocation("/set-password");
      } else {
        setLocation("/");
      }
    }
  }, [user, setLocation]);

  const loginMutation = useDoctorLogin({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        if (data?.doctor?.mustChangePassword) {
          setLocation("/set-password");
        } else {
          toast({
            title: "Welcome back",
            description: "Successfully logged in to the dashboard.",
          });
          setLocation("/");
        }
      },
      onError: (error: Error) => {
        toast({
          variant: "destructive",
          title: "Login failed",
          description: error.message || "Please check your credentials and try again.",
        });
      }
    }
  });

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate({ data: values });
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-teal-50 p-4">
      <div className="absolute inset-0 bg-grid-slate-200/[0.04] bg-[bottom_1px_center]" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg shadow-primary/10 text-primary mb-4 border border-primary/10">
            <Stethoscope className="h-8 w-8" />
          </div>
          <h1 className="font-display text-3xl font-bold text-slate-900 tracking-tight">KetoKid Care</h1>
          <p className="text-slate-500 mt-2">Pediatric Ketogenic Therapy Portal</p>
        </div>

        <Card className="border-0 shadow-xl shadow-black/5 bg-white/90 backdrop-blur-sm rounded-2xl overflow-hidden">
          <div className="h-2 w-full bg-gradient-to-r from-primary to-secondary" />
          <CardHeader className="space-y-1 pb-6 px-8 pt-8">
            <CardTitle className="text-2xl font-bold">Staff Login</CardTitle>
            <CardDescription className="text-base">
              Enter your credentials to access patient records.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <Label className="text-slate-700 font-semibold">Username</Label>
                      <FormControl>
                        <Input 
                          placeholder="admin" 
                          className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-colors" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <Label className="text-slate-700 font-semibold">Password</Label>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="••••••••" 
                          className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-colors" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full h-12 rounded-xl text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98]"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" /> Signing in...
                    </span>
                  ) : "Sign In"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
