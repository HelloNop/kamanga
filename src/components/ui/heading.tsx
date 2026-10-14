interface HeadingProps {
  title: string;
  description: string;
}

export function Heading({ title, description }: HeadingProps) {
  return (
    <div>
      <h2 className='text-[1.75rem] leading-[1.15] font-bold tracking-tight md:text-4xl'>
        {title}
      </h2>
      <p className='text-muted-foreground mt-1.5 text-[0.9375rem]'>{description}</p>
    </div>
  );
}
