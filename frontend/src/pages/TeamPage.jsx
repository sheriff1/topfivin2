import { useParams } from 'react-router-dom';

export function TeamPage() {
  const { teamId } = useParams();

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Team {teamId}</h1>
    </div>
  );
}
