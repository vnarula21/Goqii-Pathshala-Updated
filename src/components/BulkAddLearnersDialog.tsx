import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, Upload } from "lucide-react";

interface ParsedLearner {
  fullName: string;
  email: string;
  password: string;
}

interface BulkResult {
  email: string;
  success: boolean;
  error?: string;
}

interface BulkAddLearnersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (users: { email: string; fullName: string; password: string }[]) => void;
  isSubmitting: boolean;
  results?: { successCount: number; failureCount: number; results: BulkResult[] };
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

export function BulkAddLearnersDialog({ open, onOpenChange, onSubmit, isSubmitting }: BulkAddLearnersDialogProps) {
  const [rawInput, setRawInput] = useState("");
  const [preview, setPreview] = useState<ParsedLearner[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

      // If the first line looks like a header row (e.g. "Full Name,Email" or
      // "name,email"), skip it - it's not an actual learner to create.
      const looksLikeHeader = lines[0] && /name/i.test(lines[0]) && /email/i.test(lines[0]);
      const dataLines = looksLikeHeader ? lines.slice(1) : lines;

      // Keep only the first two comma-separated columns (name, email), in
      // case the CSV has extra columns we don't need.
      const cleaned = dataLines
        .map((line) => line.split(",").slice(0, 2).map((p) => p.trim()).join(", "))
        .join("\n");

      setRawInput(cleaned);
      setParseError(null);
    };
    reader.onerror = () => {
      setParseError("Could not read that file. Please make sure it's a valid CSV.");
    };
    reader.readAsText(file);

    // Reset the input so selecting the same file again re-triggers onChange
    e.target.value = "";
  };

  const handleParse = () => {
    setParseError(null);
    const lines = rawInput.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

    if (lines.length === 0) {
      setParseError("Please paste at least one learner (Full Name, Email per line)");
      return;
    }

    if (lines.length > 500) {
      setParseError("Maximum 500 learners per upload");
      return;
    }

    const parsed: ParsedLearner[] = [];
    for (const line of lines) {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        setParseError(`Invalid line (expected "Full Name, Email"): "${line}"`);
        return;
      }
      const [fullName, email] = parts;
      if (!email.includes("@")) {
        setParseError(`Invalid email in line: "${line}"`);
        return;
      }
      parsed.push({ fullName, email, password: generateTempPassword() });
    }

    setPreview(parsed);
  };

  const handleConfirm = () => {
    onSubmit(preview.map(({ fullName, email, password }) => ({ fullName, email, password })));
    setSubmitted(true);
  };

  const handleClose = () => {
    setRawInput("");
    setPreview([]);
    setParseError(null);
    setSubmitted(false);
    onOpenChange(false);
  };

  const downloadCredentials = () => {
    const csv = "Full Name,Email,Temporary Password\n" + preview.map(p => `${p.fullName},${p.email},${p.password}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "learner-credentials.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Add Learners</DialogTitle>
          <DialogDescription>
            Paste one learner per line, in the format: Full Name, Email
          </DialogDescription>
        </DialogHeader>

        {preview.length === 0 ? (
          <>
            <input
              type="file"
              accept=".csv,text/csv"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV file
            </Button>
            <p className="text-xs text-muted-foreground text-center -mt-2">or paste directly below</p>
            <Textarea
              placeholder={"Jane Doe, jane@example.com\nJohn Smith, john@example.com"}
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
            {parseError && <p className="text-sm text-destructive">{parseError}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleParse}>Preview</Button>
            </DialogFooter>
          </>
        ) : !submitted ? (
          <>
            <p className="text-sm text-muted-foreground">
              {preview.length} learner{preview.length !== 1 ? "s" : ""} ready to create. A temporary password will be generated for each — they'll be asked to change it on first login.
            </p>
            <div className="max-h-64 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{p.fullName}</TableCell>
                      <TableCell>{p.email}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreview([])}>Back</Button>
              <Button onClick={handleConfirm} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create {preview.length} Learners
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Learners created. Download the temporary passwords now — for security, they won't be shown again after you close this window.
            </p>
            <Button variant="outline" onClick={downloadCredentials}>
              <Download className="h-4 w-4 mr-2" />
              Download credentials (CSV)
            </Button>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
