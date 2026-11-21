function CategoryPreferences({ categories }) {
  return (
    <section className="preferences-panel" aria-labelledby="interests-heading">
      <h2 id="interests-heading">Your event interests</h2>
      <p id="preferences-requirements">Sign in and connect Google Calendar before choosing your preferences.</p>
      <fieldset className="category-choices" disabled aria-describedby="preferences-requirements">
        <legend>Event categories</legend>
        {categories.map((category) => (
          <label className="category-choice" key={category}>
            <input type="checkbox" defaultChecked={false} />
            <span>{category}</span>
          </label>
        ))}
      </fieldset>
      <p className="preference-note">Account sign-in and Google Calendar connection are not available yet. No preferences are being saved.</p>
    </section>
  )
}

export default CategoryPreferences
