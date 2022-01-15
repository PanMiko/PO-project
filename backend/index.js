const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

// TODO: REANAME ENDPOINTS | CLEAN CODE | ADD RESPONSE STATUSES | SPLIT INTO SEPERATE FILES

// ?USER ACCOUNT UPDATE
app.get("/users/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const user = await pool.query("SELECT * FROM uzytkownik WHERE id = $1", [id]);
    res.json(user.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(400).send(err.message);
  }
});

app.patch('/users/:id', async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['imie', 'nazwisko', 'login', 'haslo'];
  const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).send({ error: 'Invalid updates!' });
  }

  const { id } = req.params;
  const { imie, nazwisko, login, haslo } = req.body;

  try {
    pool.query(
      "UPDATE uzytkownik SET imie=$1, nazwisko = $2, login = $3, haslo = $4 WHERE id = $5 RETURNING *",
      [imie, nazwisko, login, haslo, id],
      (err, results) => {
        if (err) {
          console.error(err.message);
          res.status(400).send({ error: err.message });
        }
        res.status(200).send(results.rows[0]);
      }
    )
  } catch (err) {
    console.error(err.message);
    res.status(400).send({error: err.message});
  }
});

// ?CREATE OWN SECTION
app.get("/sections", async (req, res) => {
  try {
    const allSections = await pool.query("SELECT * FROM odcinek");
    res.json(allSections.rows);
  } catch (err) {
    console.error(err.message);
    res.status(400).send(err.message);
  }
});

app.get("/points", async (req, res) => {
  try {
    const allPoints = await pool.query("SELECT * FROM punkt");
    res.json(allPoints.rows);
  } catch (err) {
    console.error(err.message);
    res.status(400).send(err.message);
  }
});

app.post("/sections", async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['uzytkownikid', 'dlugosc', 'przewyzszenie', 'punkty', 'punktpoczatkowyid', 'punktkoncowyid'];
  const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).send({ error: 'Invalid updates!' });
  }

  const { uzytkownikid, dlugosc, przewyzszenie, punkty, punktpoczatkowyid, punktkoncowyid } = req.body;

  try {
    const allSections = await pool.query("SELECT * FROM odcinek");
    const userStartPoint = await pool.query("SELECT * FROM punkt WHERE id = $1", [punktpoczatkowyid]);
    const userEndPoint = await pool.query("SELECT * FROM punkt WHERE id = $1", [punktkoncowyid]);

    const startPointRange = userStartPoint.rows[0].pasmonazwa;
    const endPointRange = userEndPoint.rows[0].pasmonazwa;

    const arePointsInSameRange = startPointRange === endPointRange;
    if (!arePointsInSameRange) {
      throw Error("Selected points do not lie in the same mountain range!");
    }

    const isSectionExists = allSections.rows.some(section => section.punktpoczatkowyid == punktpoczatkowyid && section.punktkoncowyid == punktkoncowyid);
    if (isSectionExists) {
      throw Error("Section with the given start and end point already exists!");
    }

    const newSectionsStatus = await pool.query("INSERT INTO stanodcinka (statusodcinkastatus, datarozpoczeciastanu, opis, datazakonczeniastanu) VALUES ($1, $2, $3, $4) RETURNING *", ["Otwarty", new Date(), `Stworzony przez użytkownika o id: ${uzytkownikid}`, null]);
    const { id } = newSectionsStatus.rows[0];
    const newSection = await pool.query("INSERT INTO odcinek (uzytkownikid, dlugosc, przewyzszenie, punkty, stanodcinkaid, punktpoczatkowyid, punktkoncowyid) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *", [uzytkownikid, dlugosc, przewyzszenie, punkty, id, punktpoczatkowyid, punktkoncowyid]);
    
    res.status(200).json({createdSection: newSection.rows[0], createdSectionStatus: newSectionsStatus.rows[0]});
  } catch (err) {
    console.error(err.message);
    res.status(400).json({error: err.message});
  }
  
});



// !CONSIDER THE REQUEST FOR ACCEPTANCE OF THE TRIP

app.get("/requests/accept_trip", async (req, res) => {
  try {
    const allAcceptTripRequests = await pool.query("SELECT * FROM wniosekoakceptacje");

    const resArr = [];

    await Promise.all(allAcceptTripRequests.rows.map(async request => {
      const userRequest = await pool.query("SELECT * FROM wniosekuzytkownika WHERE id = $1", [request.wniosekuzytkownikaid]);
      const userTrip = pool.query("SELECT * FROM wycieczka WHERE id = $1", [request.wycieczkaid]);
      
      const user = pool.query("SELECT * FROM uzytkownik WHERE id = $1", [userRequest.rows[0].uzytkownikskladajacyid]);

      await Promise.all([userTrip, user]).then(function([resultA, resultB]) {
        const points = resultA.rows[0].liczbapunktow;
        const name = resultB.rows[0].imie;
        const surname = resultB.rows[0].nazwisko;
        resArr.push({requestId: request.wniosekuzytkownikaid, name, surname, points});
      });
    }));

    res.json(resArr);
  } catch (err) {
    console.error(err.message);
    res.status(400).json({error: err.message});
  }
});

app.get("/requests/accept_trip/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const allAcceptTripRequests = await pool.query("SELECT * FROM wniosekoakceptacje WHERE wniosekuzytkownikaid = $1", [id]);

    let response = {};

    await Promise.all(allAcceptTripRequests.rows.map(async request => {
      const userRequest = await pool.query("SELECT * FROM wniosekuzytkownika WHERE id = $1", [request.wniosekuzytkownikaid]);
      const userTrip = await pool.query("SELECT * FROM wycieczka WHERE id = $1", [request.wycieczkaid]);
      
      const user = await pool.query("SELECT * FROM uzytkownik WHERE id = $1", [userRequest.rows[0].uzytkownikskladajacyid]);
      
      const dateOfSubmission = userRequest.rows[0].datazlozenia;
      const points = userTrip.rows[0].liczbapunktow;
      const startDate = userTrip.rows[0].datarozpoczecia;
      const endDate = userTrip.rows[0].datazakonczenia;
      const timeTripInMinutes = (endDate - startDate) / 60 / 1000;
      const name = user.rows[0].imie;
      const surname = user.rows[0].nazwisko;
      response = {
        requestId: request.wniosekuzytkownikaid,
        name, 
        surname, 
        points, 
        dateOfSubmission,
        startDate,
        endDate,
        timeTripInMinutes,
        photo: request.zdjeciezrodlo,
      };
    }));

    res.json(response);
  } catch (err) {
    console.error(err.message);
    res.status(400).json({error: err.message});
  }
});


// TODO: PATCH WNIOSKU O AKTEPTACJE WYCIECZKI
//* JEZELI przodownik rozpatrzy OK
//*    to DELETE wniosek o akceptacje
//*       UPDATE wnioski uzytkownika (komentarz = NULL, datarozpatrzenia = DATE, statuswnioski = ZAAKCEPTOWANY)
//*       UPDATE wycieczka (na Zaakceptowana)
//* ELSE (Jezeli rozpatrzy NEGATYWNIE)
//*   to DELETE wniosek o aktualizacje
//*      UPDATE wnioski uzytkownika (komentarz = STRING, datarozpatrzenia = DATE, statuswniosku = ODRZUCONY)
//*       UPDATE wycieczka (na Odrzucona)

// ?CONSIDER SELECTION STATUS UPDATE REQUEST
app.get("/requests/update_selection_status", async (req, res) => {
  try {
    const allUpdateRequests = await pool.query("SELECT * FROM wniosekoaktualizacje");

    const resArr = [];

    await Promise.all(allUpdateRequests.rows.map(async request => {
      const userRequest = await pool.query("SELECT * FROM wniosekuzytkownika WHERE id = $1", [request.wniosekuzytkownikaid]);
      const user = pool.query("SELECT * FROM uzytkownik WHERE id = $1", [userRequest.rows[0].uzytkownikskladajacyid]);
      const newStatusPool = pool.query("SELECT * FROM stanodcinka WHERE id = $1", [request.stanodcinkaid]);

      const selection = await pool.query("SELECT * FROM odcinek WHERE id = $1", [request.odcinekid]);
      const oldStatusPool = pool.query("SELECT * FROM stanodcinka WHERE id = $1", [selection.rows[0].stanodcinkaid]);


      await Promise.all([user, newStatusPool, oldStatusPool]).then(function([userResult, newStatusPoolResult, oldStatusPoolResult]) {
        const name = userResult.rows[0].imie;
        const surname = userResult.rows[0].nazwisko;
        const newStatus = newStatusPoolResult.rows[0].statusodcinkastatus;
        const oldStatus = oldStatusPoolResult.rows[0].statusodcinkastatus;
        resArr.push({
          requestId: request.wniosekuzytkownikaid,
          name,
          surname,
          newStatus,
          oldStatus,
        });
      });
    }));

    res.json(resArr);
  } catch (err) {
    console.error(err.message);
    res.status(400).json({error: err.message});
  }
});

app.get("/requests/update_selection_status/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const updateRequests = await pool.query("SELECT * FROM wniosekoaktualizacje WHERE wniosekuzytkownikaid = $1", [id]);

    const userRequest = await pool.query("SELECT * FROM wniosekuzytkownika WHERE id = $1", [updateRequests.rows[0].wniosekuzytkownikaid]);
    const user = await pool.query("SELECT imie, nazwisko FROM uzytkownik WHERE id = $1", [userRequest.rows[0].uzytkownikskladajacyid]);
    const newStatusPool = await pool.query("SELECT * FROM stanodcinka WHERE id = $1", [updateRequests.rows[0].stanodcinkaid]);
    const selection = await pool.query("SELECT * FROM odcinek WHERE id = $1", [updateRequests.rows[0].odcinekid]);
    const currentStatusPool = await pool.query("SELECT * FROM stanodcinka WHERE id = $1", [selection.rows[0].stanodcinkaid]);

    res.json({
      requestId: updateRequests.rows[0].wniosekuzytkownikaid,
      dateOfSubmission: userRequest.rows[0].datazlozenia,
      requester: user.rows[0],
      newStatus: newStatusPool.rows[0],
      currentStatus: {selectionId: selection.rows[0].id, currentStatus: currentStatusPool.rows[0]}, 
    });
  } catch (err) {
    console.error(err.message);
    res.status(400).json({error: err.message});
  }
});


//* JEZELI admin rozpatrzy OK
//*    to DELETE wniosek o aktualizacje
//*       UPDATE wnioski uzytkownika (komentarz = NULL, datarozpatrzenia = DATE)
//*       UPDATE odcinek (o stan odcinka z tabeli stanodcinka)
//* ELSE (Jezeli rozpatrzy NEGATYWNIE)
//*   to DELETE wniosek o aktualizacje
//*      UPDATE wnioski uzytkownika (komentarz = STRING, datarozpatrzenia = DATE)

app.patch('/requests/update_selection_status/accept/:id', async (req, res) => {
  const wniosekuzytkownikaid = req.params.id;

  const datarozpatrzenia = new Date();

  let x = {};
  try {
    const singleUpdateSelectionStatusRequest = await pool.query("SELECT * FROM wniosekoaktualizacje WHERE wniosekuzytkownikaid = $1", [wniosekuzytkownikaid]);
    x = singleUpdateSelectionStatusRequest.rows[0];
  } catch (err) {
    console.error(err.message);
    return res.status(400).send(err.message);
  }

  if (x === undefined) {
    return res.status(400).send('wniosekoaktualizacje NOT FOUND');
  }

  const stanodcinkaid = x.stanodcinkaid;
  const odcinekid = x.odcinekid;

  try {
    // DELETE wniosek o aktualizacje 
    const deleteResult = await pool.query(
      "DELETE FROM wniosekoaktualizacje WHERE wniosekuzytkownikaid = $1 RETURNING *",
      [wniosekuzytkownikaid]
    );
    const res1 = deleteResult.rows[0];

    const newStatus = "Zaakceptowany";
    // UPDATE wnioski uzytkownika (komentarz = NULL (BEZ ZMIAN), datarozpatrzenia = DATE)
    const updateUserRequestsResult = await pool.query(
      "UPDATE wniosekuzytkownika SET datarozpatrzenia = $1, statuswnioskustatus = $2 WHERE id = $3 RETURNING *",
      [datarozpatrzenia, newStatus, wniosekuzytkownikaid]
    );
    const res2 = updateUserRequestsResult.rows[0];

    // UPDATE odcinek (o stan odcinka z tabeli stanodcinka)
    const updateSelectionRequest = await pool.query(
      "UPDATE odcinek SET stanodcinkaid = $1 WHERE id = $2 RETURNING *", [stanodcinkaid, odcinekid]);
    const res3 = updateSelectionRequest.rows[0];

    res.status(200).send({res1, res2, res3});
  } catch (err) {
    console.error(err.message);
    res.status(400).send({error: err.message});
  }
});

app.patch('/requests/update_selection_status/reject/:id', async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['komentarzzwrotny'];
  //const isValidOperation = updates.every((update) => allowedUpdates.includes(update));
  const isValidOperation = arrayEquals(allowedUpdates, updates);

  if (!isValidOperation) {
    return res.status(400).send({ error: 'Invalid updates!' });
  }

  const wniosekuzytkownikaid = req.params.id;
  const { komentarzzwrotny } = req.body;
  const datarozpatrzenia = new Date();

  let x = {};
  try {
    const singleUpdateSelectionStatusRequest = await pool.query("SELECT * FROM wniosekoaktualizacje WHERE wniosekuzytkownikaid = $1", [wniosekuzytkownikaid]);
    x = singleUpdateSelectionStatusRequest.rows[0];
  } catch (err) {
    console.error(err.message);
    return res.status(400).json(err.message);
  }

  if (x === undefined) {
    return res.status(400).json('wniosekoaktualizacje NOT FOUND');
  }

  try {
    // DELETE wniosek o aktualizacje 
    const deleteResult = await pool.query(
      "DELETE FROM wniosekoaktualizacje WHERE wniosekuzytkownikaid = $1 RETURNING *",
      [wniosekuzytkownikaid]
    );
    const res1 = deleteResult.rows[0];

    const newStatus = "Odrzucony";
    // UPDATE wnioski uzytkownika (komentarzzwrotny = STRING, datarozpatrzenia = DATE)
    const updateUserRequestsResult = await pool.query(
      "UPDATE wniosekuzytkownika SET datarozpatrzenia = $1, komentarzzwrotny = $2, statuswnioskustatus = $3 WHERE id = $4 RETURNING *",
      [datarozpatrzenia, komentarzzwrotny, newStatus, wniosekuzytkownikaid]
    );
    const res2 = updateUserRequestsResult.rows[0];

    return res.status(200).json({res1, res2});
  } catch (err) {
    console.error(err.message);
    res.status(400).json({error: err.message});
  }
});

app.listen(5000, () => {
  console.log("server has started on port 5000");
});

const arrayEquals = (a, b) => {
  return Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((val, index) => val === b[index]);
}