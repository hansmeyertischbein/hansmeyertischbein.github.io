/* Practice cases. All companies and figures are fictional unless a source is given.
 * Each case: brief, clarifications (asked on demand), a model structure (issue tree),
 * exhibits, questions with numeric answers and worked solutions, and a model recommendation.
 */
window.CASES = [
  {
    id: 'bakery',
    title: 'Fjellbrød: why did profit fall?',
    type: 'Profitability',
    minutes: 25,
    level: 'Core',
    brief: 'Fjellbrød is a bakery chain with 40 shops in Eastern Norway. Revenue grew last year, but operating profit fell from NOK 48 million in 2024 to NOK 30 million in 2025. The CEO asks you to find out why, and what to do about it.',
    clarify: [
      { q: 'What does Fjellbrød sell?', a: 'Coffee, buns and pastries in the morning, sandwiches and salads at lunch, and bread in the afternoon. Everything is baked in each shop.' },
      { q: 'Has the number of shops changed?', a: 'No. Still 40 shops, same locations, same opening hours.' },
      { q: 'Did anything happen in the market?', a: 'Several grocery chains opened in-store bakeries near commuter stations in 2025 and sell coffee and a bun for NOK 39.' },
      { q: 'Did Fjellbrød change its prices?', a: 'Yes. Prices were raised in January 2025 to cover higher ingredient costs.' },
      { q: 'What is the objective?', a: 'Get back to at least 2024 profit within two years, without closing shops.' }
    ],
    structure: {
      label: 'Profit fell by NOK 18 m',
      children: [
        { label: 'Revenue', children: [
          { label: 'Transactions', children: [{ label: 'By time of day' }, { label: 'By shop' }] },
          { label: 'Average ticket', children: [{ label: 'Price' }, { label: 'Items per visit' }] }
        ] },
        { label: 'Costs', children: [
          { label: 'Variable', children: [{ label: 'Ingredients' }, { label: 'Packaging' }] },
          { label: 'Fixed', children: [{ label: 'Staff' }, { label: 'Rent' }, { label: 'Energy' }] }
        ] },
        { label: 'Market', children: [{ label: 'Competitors' }, { label: 'Customer needs' }] }
      ]
    },
    exhibits: [
      { title: 'Exhibit 1: Profit and loss, NOK million', kind: 'table',
        head: ['', '2024', '2025'],
        rows: [['Revenue', '600', '612'], ['Ingredients', '150', '171'], ['Staff', '240', '246'], ['Rent', '90', '92'], ['Energy', '30', '30'], ['Other', '42', '43'], ['Operating profit', '48', '30']],
        note: 'Ingredient cost per transaction was NOK 15.00 in 2024.' },
      { title: 'Exhibit 2: Transactions and average ticket by time of day', kind: 'table',
        head: ['', 'Transactions 2024, m', 'Transactions 2025, m', 'Ticket 2024, NOK', 'Ticket 2025, NOK'],
        rows: [['Morning', '5.0', '4.0', '50', '58'], ['Lunch', '3.0', '3.0', '70', '80'], ['Afternoon', '2.0', '2.0', '70', '70'], ['Total', '10.0', '9.0', '60', '68']] },
      { title: 'Exhibit 3: Change in transactions 2024 to 2025, million', kind: 'bars',
        bars: [{ label: 'Morning', value: -1.0 }, { label: 'Lunch', value: 0 }, { label: 'Afternoon', value: 0 }], format: 1 }
    ],
    questions: [
      { q: 'What was the operating margin in 2024 and in 2025? Give 2025, in percent.', answer: 4.9, unit: '%', tol: 0.15,
        solution: '2024: 48 / 600 = 8.0%. 2025: 30 / 612 = 4.9%. The margin fell by about 3 points even though revenue grew 2%.' },
      { q: 'By how much did the number of transactions change, in percent?', answer: -10, unit: '%', tol: 0.5,
        solution: 'From 10.0 to 9.0 million: −1.0 / 10.0 = −10%. The average ticket rose from 60 to 68, +13%, which more than offset it in revenue.' },
      { q: 'What was the ingredient cost per transaction in 2025, in NOK?', answer: 19, unit: 'NOK', tol: 0.2,
        solution: '171 / 9.0 = NOK 19.00, up from 15.00. Ingredients rose 27% per transaction, more than the 13% rise in the average ticket. Staff, rent and energy hardly moved and are largely fixed.' },
      { q: 'Fjellbrød considers cutting the morning ticket back to NOK 50 for everyone. Assume this wins back all 1.0 million lost morning transactions, ingredient cost is NOK 16 per morning transaction, and fixed costs do not change. What is the change in operating profit, in NOK million?', answer: 2, unit: 'NOK m', tol: 1,
        solution: 'Price cut on today’s morning customers: 4.0 m × (50 − 58) = −32. Regained customers: 1.0 m × (50 − 16) = +34. Net +2 million. A general price cut barely pays, because most of it goes to customers who never left.' }
    ],
    recommendation: [
      'The profit fall has two causes. Ingredient costs rose about NOK 4 per visit, and the price rise in January drove away a fifth of morning customers, most likely to the grocery bakeries selling coffee and a bun for NOK 39.',
      'Do not cut morning prices across the board: it would add only about NOK 2 million. Instead, win back the price-sensitive commuters with a targeted offer, for example a coffee subscription or an app price that only new and lapsed customers see.',
      'Protect the lunch business, where Fjellbrød raised prices 14% without losing a single transaction. That shows pricing power where the product is different from what the grocery chains sell.',
      'Work on ingredient cost per visit: buying flour and dairy on longer contracts, a smaller range in the afternoon, and less waste at closing.',
      'Next steps: test the morning offer in five shops near stations for eight weeks, and track morning transactions, ticket and margin per shop.'
    ],
    pitfalls: ['Stopping at "costs went up" without noticing that transactions fell.', 'Treating staff and rent as variable costs.', 'Recommending a general price cut without doing the maths on existing customers.']
  },
  {
    id: 'schoolbags',
    title: 'The Norwegian market for school bags',
    type: 'Market sizing',
    minutes: 8,
    level: 'Warm-up',
    brief: 'A Danish maker of ergonomic school bags is thinking about entering Norway. How large is the Norwegian market for school bags, in NOK a year?',
    clarify: [
      { q: 'Which bags count?', a: 'Bags bought for school use by children in primary, lower secondary and upper secondary school. Not laptop bags for adults.' },
      { q: 'Should I count units or value?', a: 'Value in NOK at retail prices, but a unit estimate on the way is useful.' },
      { q: 'How precise does it need to be?', a: 'Within a factor of two. The client wants to know if it is worth a closer look.' }
    ],
    structure: {
      label: 'Market value per year',
      children: [
        { label: 'First graders', children: [{ label: 'Children per year group' }, { label: 'Share buying a new bag' }, { label: 'Price of a first-grade bag' }] },
        { label: 'Grades 2 to 10', children: [{ label: 'Pupils' }, { label: 'Years a bag lasts' }, { label: 'Average price' }] },
        { label: 'Upper secondary', children: [{ label: 'Pupils' }, { label: 'Share using a school bag' }, { label: 'Years a bag lasts' }, { label: 'Average price' }] }
      ]
    },
    exhibits: [
      { title: 'Assumptions to use', kind: 'table', head: ['Assumption', 'Value'],
        rows: [['Children per year group', 'about 60,000'], ['First graders buying a new bag', '100%'], ['Price of a first-grade bag', 'NOK 1,500'],
          ['Grades 2 to 10: a bag lasts', '3 years'], ['Grades 2 to 10: average price', 'NOK 600'], ['Upper secondary: share using a school bag', '50%'], ['Upper secondary: a bag lasts', '3 years'], ['Upper secondary: average price', 'NOK 500']],
        note: 'These are interview assumptions, not market data. In an interview you would propose them yourself and say why.' }
    ],
    questions: [
      { q: 'How many bags a year are bought for grades 2 to 10?', answer: 180000, unit: 'bags', tol: 0.02, rel: true,
        solution: '9 year groups × 60,000 = 540,000 pupils. A bag lasts 3 years, so 540,000 / 3 = 180,000 bags a year.' },
      { q: 'What is the total market, in NOK million a year?', answer: 213, unit: 'NOK m', tol: 0.05, rel: true,
        solution: 'First grade: 60,000 × 1,500 = 90 m. Grades 2 to 10: 180,000 × 600 = 108 m. Upper secondary: 3 × 60,000 × 50% / 3 = 30,000 bags × 500 = 15 m. Total about NOK 213 million, so roughly NOK 200 million.' }
    ],
    recommendation: [
      'The market is roughly NOK 200 million a year, and close to half of it is first-grade bags, where the ergonomic, premium segment sits.',
      'Sanity check: about NOK 270 a year per pupil, which feels right for a product that costs a few hundred to a couple of thousand kroner and lasts a few years.',
      'For a premium entrant the relevant market is first grade plus parents who replace a bag in grades 2 to 4. Next step: check how many first graders get a premium bag and through which shops.'
    ],
    pitfalls: ['Forgetting that bags last several years.', 'Counting all children 0 to 18.', 'Giving one number without showing the segments.']
  },
  {
    id: 'gym',
    title: 'StarkFit: should it open in Oslo?',
    type: 'Market entry',
    minutes: 20,
    level: 'Core',
    brief: 'StarkFit, a Swedish low-cost gym chain, wants to open its first gym in Oslo in a new residential area. Should it, and how many members does it need?',
    clarify: [
      { q: 'What is StarkFit’s model?', a: 'Open 24 hours, few staff, monthly membership with no binding period.' },
      { q: 'What does a gym cost?', a: 'See exhibit 1.' },
      { q: 'How many people live in the area?', a: 'About 60,000 adults live within 10 minutes. About a quarter of Oslo adults hold a gym membership.' },
      { q: 'Who are the competitors?', a: 'Six gyms already serve the area, a mix of premium and low-cost chains.' },
      { q: 'What does StarkFit need to see?', a: 'Payback on the fit-out within three years.' }
    ],
    structure: {
      label: 'Open the gym?',
      children: [
        { label: 'Market', children: [{ label: 'Adults in the area' }, { label: 'Gym penetration' }, { label: 'Competitors and share' }] },
        { label: 'Economics', children: [{ label: 'Price and variable cost' }, { label: 'Fixed costs' }, { label: 'Break-even members' }, { label: 'Payback' }] },
        { label: 'Ability to win', children: [{ label: 'Price position' }, { label: 'Location' }, { label: 'Brand' }] },
        { label: 'Risks', children: [{ label: 'Competitor reaction' }, { label: 'Ramp-up time' }] }
      ]
    },
    exhibits: [
      { title: 'Exhibit 1: One gym, NOK', kind: 'table', head: ['Item', 'Value'],
        rows: [['Membership, per month', '449'], ['Variable cost per member, per month', '49'], ['Rent, per year', '3,600,000'], ['Staff, per year', '2,400,000'], ['Equipment depreciation, per year', '1,000,000'], ['Other fixed costs, per year', '1,000,000'], ['Fit-out investment, one-off', '6,000,000'], ['Capacity', '3,000 members']] }
    ],
    questions: [
      { q: 'How many members does the gym need to break even?', answer: 1667, unit: 'members', tol: 0.01, rel: true,
        solution: 'Contribution per member: 449 − 49 = 400 a month, 4,800 a year. Fixed costs: 3.6 + 2.4 + 1.0 + 1.0 = NOK 8.0 million. Break-even: 8,000,000 / 4,800 = 1,667 members.' },
      { q: 'If StarkFit gets a fair share of the local market, how many members is that?', answer: 2143, unit: 'members', tol: 0.02, rel: true,
        solution: '60,000 × 25% = 15,000 gym members in the area. With StarkFit as the seventh gym, a fair share is 15,000 / 7 = about 2,143 members.' },
      { q: 'What is the annual profit at a fair share, in NOK million?', answer: 2.29, unit: 'NOK m', tol: 0.05, rel: true,
        solution: '2,143 × 4,800 = 10.29 million in contribution, less 8.0 million fixed costs = about NOK 2.29 million a year.' },
      { q: 'How many years is the payback on the fit-out?', answer: 2.6, unit: 'years', tol: 0.1,
        solution: '6.0 / 2.29 = 2.6 years. Inside the three-year requirement, but not by much.' }
    ],
    recommendation: [
      'Open the gym, but with a plan to grow faster than a fair share. At a fair share of about 2,100 members it makes NOK 2.3 million a year and pays back in 2.6 years, inside the three-year target.',
      'The margin of safety is thin: break-even is about 1,700 members, only 22% below a fair share. Ramp-up usually takes a year or more, which would push payback past three years.',
      'StarkFit has a reason to win more than a fair share: it is the cheapest gym in the area and open all night. Pre-sell memberships before opening and target new residents as they move in.',
      'Risks: competitors cut prices, or the area fills more slowly than planned. Next step: check rents and the timing of new housing, and test pre-sales.'
    ],
    pitfalls: ['Using monthly price against annual costs.', 'Forgetting variable cost per member.', 'Saying yes because payback is under three years without discussing ramp-up.']
  },
  {
    id: 'ferry',
    title: 'Electric ferry: is the investment worth it?',
    type: 'Investment',
    minutes: 20,
    level: 'Core',
    brief: 'A ferry operator runs a diesel ferry on a fjord crossing under a 15-year contract with the county. It can convert the ferry to battery-electric power. Should it, and what could make the decision go wrong?',
    clarify: [
      { q: 'What does it cost?', a: 'NOK 45 million for batteries, conversion and a charger on the quay. A public grant covers 30%. The batteries must be replaced after 10 years for NOK 15 million.' },
      { q: 'What changes in running costs?', a: 'See exhibit 1.' },
      { q: 'What return does the operator require?', a: 'Use a 6% discount rate. Ignore tax.' },
      { q: 'Does the county pay more for an electric ferry?', a: 'No. The contract payment is the same.' }
    ],
    structure: {
      label: 'Convert the ferry?',
      children: [
        { label: 'Financial', children: [{ label: 'Net investment' }, { label: 'Annual savings' }, { label: 'NPV and payback' }] },
        { label: 'Risks', children: [{ label: 'Electricity price' }, { label: 'Battery life' }, { label: 'Downtime' }] },
        { label: 'Strategic', children: [{ label: 'Emissions' }, { label: 'Next contract' }] }
      ]
    },
    exhibits: [
      { title: 'Exhibit 1: Annual running costs, NOK million', kind: 'table', head: ['', 'Diesel', 'Electric'],
        rows: [['Fuel or electricity', '12.0', '4.0'], ['Maintenance', '3.0', '2.0'], ['Total', '15.0', '6.0']],
        note: 'Diesel use is about 1.0 million litres a year. Burning one litre of diesel emits about 2.66 kg of CO₂.' },
      { title: 'Exhibit 2: Annual running costs, NOK million', kind: 'bars',
        bars: [{ label: 'Diesel', value: 15 }, { label: 'Electric', value: 6 }], format: 0 }
    ],
    questions: [
      { q: 'What are the annual savings, in NOK million?', answer: 9, unit: 'NOK m', tol: 0.05,
        solution: '15.0 − 6.0 = NOK 9.0 million a year.' },
      { q: 'What is the simple payback on the net investment, in years?', answer: 3.5, unit: 'years', tol: 0.05,
        solution: 'Net investment 45 × (1 − 30%) = 31.5 million. 31.5 / 9.0 = 3.5 years.' },
      { q: 'What is the NPV over the 15-year contract at 6%, including the battery replacement in year 10, in NOK million?', answer: 47.5, unit: 'NOK m', tol: 0.6,
        solution: 'Annuity factor for 15 years at 6%: (1 − 1.06⁻¹⁵) / 0.06 = 9.712. Savings: 9.0 × 9.712 = 87.4. Battery: 15 / 1.06¹⁰ = 8.4. NPV = 87.4 − 31.5 − 8.4 = about NOK 47.5 million.' },
      { q: 'How many tonnes of CO₂ a year does the conversion avoid?', answer: 2660, unit: 'tonnes', tol: 0.02, rel: true,
        solution: '1.0 million litres × 2.66 kg = 2,660 tonnes a year, if the electricity comes from hydropower with close to no emissions.' }
    ],
    recommendation: [
      'Convert the ferry. The NPV is about NOK 47 million and the payback 3.5 years, well inside the 15-year contract, and it cuts about 2,660 tonnes of CO₂ a year.',
      'The case survives the obvious risk: if electricity costs double, savings fall to NOK 5 million and the NPV is still about NOK 9 million positive.',
      'The real risks are battery life and downtime during the conversion. Negotiate a battery warranty and plan the work for the low season.',
      'It also strengthens the next contract bid, since counties increasingly require zero-emission ferries.'
    ],
    pitfalls: ['Forgetting the grant or the battery replacement.', 'Using simple payback alone.', 'Not testing the electricity price.']
  },
  {
    id: 'coffee',
    title: 'Cups of coffee sold in Oslo on a weekday',
    type: 'Market sizing',
    minutes: 6,
    level: 'Warm-up',
    brief: 'A coffee machine supplier asks: how many cups of coffee do cafés and kiosks in Oslo sell on an ordinary weekday?',
    clarify: [
      { q: 'Does coffee at home or at work count?', a: 'No, only coffee bought over the counter in cafés, bakeries, kiosks and petrol stations.' },
      { q: 'Who drinks it?', a: 'Your call. Both people who live in Oslo and people who commute in.' }
    ],
    structure: {
      label: 'Cups per weekday',
      children: [
        { label: 'People in Oslo during the day', children: [{ label: 'Adult residents' }, { label: 'Net commuters in' }] },
        { label: 'Share who buy coffee' },
        { label: 'Cups per buyer' }
      ]
    },
    exhibits: [
      { title: 'Assumptions to use', kind: 'table', head: ['Assumption', 'Value'],
        rows: [['Residents', 'about 700,000'], ['Share adults', '80%'], ['Net commuters into Oslo', 'about 100,000'], ['Share of adults buying coffee on a weekday', '20%'], ['Cups per buyer', '1.3']],
        note: 'Interview assumptions, chosen to be easy to calculate with.' }
    ],
    questions: [
      { q: 'How many cups are sold on a weekday?', answer: 171600, unit: 'cups', tol: 0.05, rel: true,
        solution: 'Adult residents: 700,000 × 80% = 560,000. Add 100,000 commuters, who are adults: 660,000 people. Buyers: 660,000 × 20% = 132,000. Cups: 132,000 × 1.3 = about 172,000.' }
    ],
    recommendation: [
      'About 170,000 cups a weekday. Over a year that is roughly 50 million cups, if weekends sell about half as much as weekdays.',
      'Say which assumption matters most (the 20% share) and how you would check it: a count at a few cafés, or sales data from a coffee chain.'
    ],
    pitfalls: ['Counting children.', 'Forgetting commuters.', 'Not stating which assumption drives the answer.']
  }
];
