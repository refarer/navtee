import ClubStats from "./clubStats";

export const Club = async ({ clubInfo }) => {
  return (
    <div className="mx-auto p-4">
      <div className="bg-white shadow-lg rounded-lg p-6 mb-4">
        {clubInfo.tags && (
          <>
            <h2 className="text-2xl font-bold mb-2">{clubInfo.tags.name}</h2>
            <div className="mb-2">
              <strong>{clubInfo.tags.website}</strong>
              <strong>{clubInfo.tags.phone}</strong>
              <strong>{clubInfo.tags.description}</strong>
            </div>
          </>
        )}
        <h3 className="text-xl font-bold mb-4">Golf Courses</h3>
        <ClubStats clubInfo={clubInfo} />
      </div>
    </div>
  );
};
