# Design mockups

`screens/*.dc.html` are 17 mockups of the app at phone size (390×844), Hebrew and RTL.

They're HTML with a small templating layer: `{{name}}` holes, `<sc-for>` loops, `<sc-if>` conditionals, and a `renderVals()` method holding sample data and interaction logic. Their runtime isn't included, so they won't render correctly on their own. Read the source for:

- exact layout, spacing, colors and type sizes (inline styles),
- all Hebrew copy and sample data,
- interaction details (what toggles, what each state shows).

Don't port the markup or the templating. Rebuild screens with React Native components and the theme tokens from [SPEC §9](../SPEC.md#9-design-system).

The screen → route → mockup mapping is in [SPEC §8](../SPEC.md#8-screens-and-routes).
