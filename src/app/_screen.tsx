// Shared centred column used by the loading, error and not-found states so they
// sit consistently and inherit the theme tokens from the root layout.
export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen px-5 pb-20 pt-7">
      <div className="mx-auto flex min-h-[calc(100vh-104px)] max-w-[560px] flex-col justify-center gap-[26px]">
        <div className="text-[30px] font-semibold tracking-[0.2em]">CURFEW</div>
        {children}
      </div>
    </main>
  );
}
