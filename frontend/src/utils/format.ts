export const formatDateTime = (value: string | null) => {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

export const getInitials = (name: string | null, email: string) => {
  const source = (name?.trim() || email).split(" ");
  return source
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};
