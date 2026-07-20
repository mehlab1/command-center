import { LoginForm } from "@/components/LoginForm";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-4 py-8">
      <ServiceWorkerRegister />
      <LoginForm />
    </main>
  );
}
