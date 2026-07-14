import { useCertificates } from "@/hooks/useCertificates";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { downloadCertificatePDF } from "@/lib/certificatePdf";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, Download, Loader2 } from "lucide-react";

export default function MyCertificates() {
  const { myCertificates, isLoading } = useCertificates();
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["my-profile-name", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      return data;
    },
    enabled: !!user,
  });

  const learnerName = profile?.full_name || user?.email || "Learner";

  return (
    <AppSidebar>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="h-6 w-6 text-primary" />
            My Certificates
          </h1>
          <p className="text-muted-foreground">Certificates you've earned by completing courses</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : myCertificates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              You haven't earned any certificates yet. Complete a course with a passing score to earn one.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {myCertificates.map((cert) => (
              <Card key={cert.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{cert.course?.title || "Course"}</CardTitle>
                      <CardDescription>
                        Issued {new Date(cert.issued_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">{cert.score}%</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">
                    Verification code: {cert.verification_code}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => downloadCertificatePDF(cert, learnerName)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppSidebar>
  );
}
