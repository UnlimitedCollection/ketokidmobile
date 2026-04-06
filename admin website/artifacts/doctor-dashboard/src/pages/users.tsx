import { useState, useRef, useCallback } from "react";
import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
} from "@workspace/api-client-react";
import { RefreshCw, Copy, Upload, ImagePlus } from "lucide-react";
import type { UserResponse, CreateUserRequest, UpdateUserRequest } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListUsersQueryKey } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Pencil, Trash2, ShieldCheck, Shield, Eye } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";

type UserFormData = {
  username: string;
  password: string;
  name: string;
  mobile: string;
  email: string;
  designation: string;
  profilePhoto: string;
  role: "admin" | "moderator";
};

const BLANK_FORM: UserFormData = {
  username: "",
  password: "",
  name: "",
  mobile: "",
  email: "",
  designation: "",
  profilePhoto: "",
  role: "moderator",
};

function generateSecurePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "@#$%!";
  const all = upper + lower + digits + special;

  function randomIndex(max: number): number {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max;
  }

  const password = [
    upper[randomIndex(upper.length)],
    lower[randomIndex(lower.length)],
    digits[randomIndex(digits.length)],
    special[randomIndex(special.length)],
  ];
  for (let i = 0; i < 8; i++) {
    password.push(all[randomIndex(all.length)]);
  }

  const shuffle = new Uint32Array(password.length);
  crypto.getRandomValues(shuffle);
  return password
    .map((char, i) => ({ char, sort: shuffle[i] }))
    .sort((a, b) => a.sort - b.sort)
    .map((x) => x.char)
    .join("");
}

function getPhotoDisplayUrl(path: string): string {
  if (path.startsWith("/objects/")) return `/api/storage${path}`;
  return path;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: me } = useGetMe();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewUser, setViewUser] = useState<UserResponse | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form, setForm] = useState<UserFormData>(BLANK_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: users = [], isLoading } = useListUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      setForm((prev) => ({ ...prev, profilePhoto: response.objectPath }));
      setPhotoPreview(`/api/storage${response.objectPath}`);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Could not upload profile photo.";
      const isStorageUnavailable = msg.includes("temporarily unavailable") || msg.includes("401") || (err as any)?.statusCode === 503;
      toast({
        title: "Upload failed",
        description: isStorageUnavailable
          ? "Storage service is not available. You can still create the user without a photo."
          : `Could not upload profile photo: ${msg}`,
        variant: "destructive",
      });
    },
  });

  function openCreate() {
    setEditingId(null);
    setForm(BLANK_FORM);
    setFormError(null);
    setPhotoPreview(null);
    setDialogOpen(true);
  }

  function openEdit(user: UserResponse) {
    setEditingId(user.id);
    setForm({
      username: user.username,
      password: "",
      name: user.name,
      mobile: user.mobile ?? "",
      email: user.email,
      designation: user.designation ?? "",
      profilePhoto: user.profilePhoto ?? "",
      role: user.role as "admin" | "moderator",
    });
    setPhotoPreview(user.profilePhoto ? getPhotoDisplayUrl(user.profilePhoto) : null);
    setFormError(null);
    setDialogOpen(true);
  }

  function openDelete(userId: number) {
    setDeletingId(userId);
    setDeleteDialogOpen(true);
  }

  function openView(user: UserResponse) {
    setViewUser(user);
    setViewDialogOpen(true);
  }

  function handleField(field: keyof UserFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormError(null);
  }

  function handleFileSelect(file: File) {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file (JPG, PNG, or WebP).", variant: "destructive" });
      return;
    }
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "File too large", description: "Profile photo must be under 5 MB.", variant: "destructive" });
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (img.width < 100 || img.height < 100) {
        toast({ title: "Image too small", description: "Minimum size is 100 × 100 pixels.", variant: "destructive" });
        return;
      }
      if (img.width > 4096 || img.height > 4096) {
        toast({ title: "Image too large", description: "Maximum dimensions are 4096 × 4096 pixels.", variant: "destructive" });
        return;
      }
      const ratio = img.width / img.height;
      if (ratio < 0.5 || ratio > 2) {
        toast({ title: "Invalid aspect ratio", description: "Photo should be roughly square (between 1:2 and 2:1 ratio).", variant: "destructive" });
        return;
      }
      uploadFile(file);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      toast({ title: "Invalid image", description: "Could not read the image file. Please try another.", variant: "destructive" });
    };
    img.src = objectUrl;
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  function handleSave() {
    if (!form.username.trim() || form.username.length < 3) {
      setFormError("Username must be at least 3 characters.");
      return;
    }
    if (!editingId && form.password.length < 6) {
      setFormError("Password must be at least 6 characters. Click Generate to create one.");
      return;
    }
    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (form.mobile.trim() && !/^\d{10}$/.test(form.mobile.trim())) {
      setFormError("Mobile number must be exactly 10 digits (e.g. 07XXXXXXXX).");
      return;
    }
    if (!form.email.trim() || !form.email.includes("@")) {
      setFormError("A valid email is required.");
      return;
    }

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    };

    if (editingId) {
      const body: UpdateUserRequest = {
        username: form.username,
        name: form.name,
        email: form.email,
        role: form.role,
        designation: form.designation.trim() || "",
        profilePhoto: form.profilePhoto || "",
        mobile: form.mobile.trim() || undefined,
      };
      if (form.password.trim()) body.password = form.password;

      updateUser.mutate(
        { userId: editingId, data: body },
        {
          onSuccess: () => {
            toast({ title: "User updated", description: `${form.name} has been updated.` });
            setDialogOpen(false);
            invalidate();
          },
          onError: (err: Error) => {
            setFormError(err.message || "Failed to update user.");
          },
        }
      );
    } else {
      const body: CreateUserRequest = {
        username: form.username,
        password: form.password,
        name: form.name,
        email: form.email,
        designation: form.designation || undefined,
        profilePhoto: form.profilePhoto || undefined,
        mobile: form.mobile.trim() || undefined,
        role: form.role,
      };
      createUser.mutate(
        { data: body },
        {
          onSuccess: () => {
            toast({ title: "User created", description: `${form.name} has been added.` });
            setDialogOpen(false);
            invalidate();
          },
          onError: (err: Error) => {
            setFormError(err.message || "Failed to create user.");
          },
        }
      );
    }
  }

  function handleDelete() {
    if (deletingId == null) return;
    deleteUser.mutate(
      { userId: deletingId },
      {
        onSuccess: () => {
          toast({ title: "User deleted", description: "The user has been removed." });
          setDeleteDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        },
        onError: (err: Error) => {
          toast({ title: "Cannot delete user", description: err.message || "Failed to delete user.", variant: "destructive" });
          setDeleteDialogOpen(false);
        },
      }
    );
  }

  function handleCopyPassword() {
    if (form.password) {
      navigator.clipboard.writeText(form.password);
      toast({ title: "Copied", description: "Password copied to clipboard." });
    }
  }

  const isMutating = createUser.isPending || updateUser.isPending || isUploading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage admin and moderator accounts</p>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-700">
            All Users ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">No users found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-slate-800">{user.name}</TableCell>
                    <TableCell className="text-slate-600 font-mono text-sm">{user.username}</TableCell>
                    <TableCell className="text-slate-500 text-sm">{user.email}</TableCell>
                    <TableCell className="text-slate-500 text-sm">{user.designation || "\u2014"}</TableCell>
                    <TableCell>
                      {user.role === "admin" ? (
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 flex items-center gap-1 w-fit">
                          <ShieldCheck className="h-3 w-3" />
                          Admin
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 flex items-center gap-1 w-fit">
                          <Shield className="h-3 w-3" />
                          Moderator
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(user)}
                          className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openView(user)}
                          className="h-8 w-8 p-0 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {user.id !== me?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDelete(user.id)}
                            className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit User" : "Add New User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {formError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{formError}</div>
            )}

            <div className="space-y-1.5">
              <Label>Profile Photo</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                  e.target.value = "";
                }}
              />
              {photoPreview ? (
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-slate-200 shrink-0">
                    <img src={photoPreview} alt="Profile" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                      Change
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPhotoPreview(null);
                        setForm((prev) => ({ ...prev, profilePhoto: "" }));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-slate-400 transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed ${isDragging ? "border-primary/50 bg-primary/5 text-primary" : "border-slate-200"}`}
                >
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <ImagePlus className="h-6 w-6" />
                  )}
                  <span className="text-sm">{isUploading ? "Uploading..." : "Drag & drop or click to upload photo"}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => handleField("name", e.target.value)}
                  placeholder="Dr. Jane Smith"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input
                  value={form.username}
                  onChange={(e) => handleField("username", e.target.value)}
                  placeholder="jsmith"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Mobile Number</Label>
              <Input
                value={form.mobile}
                onChange={(e) => handleField("mobile", e.target.value)}
                placeholder="e.g. 07XXXXXXXX"
                maxLength={10}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => handleField("email", e.target.value)}
                placeholder="jsmith@hospital.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Designation (optional)</Label>
              <Input
                value={form.designation}
                onChange={(e) => handleField("designation", e.target.value)}
                placeholder="Pediatric Neurologist"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => handleField("role", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!editingId && (
              <div className="space-y-1.5">
                <Label>Password</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={form.password}
                    readOnly
                    placeholder="Click Generate to create a password"
                    className="font-mono text-sm flex-1 bg-slate-50"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={() => handleField("password", generateSecurePassword())}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Generate
                  </Button>
                  {form.password && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0 h-9 w-9"
                      onClick={handleCopyPassword}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-slate-500">Generate a temporary password and share it with the new user.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isMutating}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isMutating}>
              {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Save Changes" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleteUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {viewUser && (
            <div className="space-y-4 py-2">
              {viewUser.profilePhoto && (
                <div className="flex justify-center">
                  <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-slate-200">
                    <img src={getPhotoDisplayUrl(viewUser.profilePhoto)} alt={viewUser.name} className="h-full w-full object-cover" />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Full Name</p>
                  <p className="text-sm text-slate-800 font-medium">{viewUser.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Username</p>
                  <p className="text-sm text-slate-800 font-mono">{viewUser.username}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Mobile Number</p>
                  <p className="text-sm text-slate-800">{viewUser.mobile || "\u2014"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Email</p>
                  <p className="text-sm text-slate-800">{viewUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Designation</p>
                  <p className="text-sm text-slate-800">{viewUser.designation || "\u2014"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Role</p>
                  <div>
                    {viewUser.role === "admin" ? (
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 flex items-center gap-1 w-fit">
                        <ShieldCheck className="h-3 w-3" />
                        Admin
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 flex items-center gap-1 w-fit">
                        <Shield className="h-3 w-3" />
                        Moderator
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Created</p>
                <p className="text-sm text-slate-800">{new Date(viewUser.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
